extends Node2D
## Grid controller for The Shallows. Mirrors browser MVP behaviour offline.
## Attach to main scene root. Replace resolution with RPC calls when backend is live.

const TILE := 48
const COLS := 12
const ROWS := 12

# 0 water, 1 path, 2 kelp, 3 rock
var map: Array = [
	[3,3,3,3,3,3,3,3,3,3,3,3],
	[3,1,1,0,0,0,0,0,1,1,1,3],
	[3,1,0,0,2,0,0,2,0,0,1,3],
	[3,0,0,1,1,0,0,1,1,0,0,3],
	[3,0,2,1,0,0,0,0,1,2,0,3],
	[3,0,0,0,0,1,1,0,0,0,0,3],
	[3,0,0,1,0,1,1,0,1,0,0,3],
	[3,0,2,1,0,0,0,0,1,2,0,3],
	[3,0,0,1,1,0,0,1,1,0,0,3],
	[3,1,0,0,2,0,0,2,0,0,1,3],
	[3,1,1,0,0,0,0,0,1,1,1,3],
	[3,3,3,3,3,3,3,3,3,3,3,3],
]

var px: int = 5
var py: int = 10
var nodes: Array = []  # {x,y,taken}
var skitters: Array = []  # {x,y,hp}
var move_cd: float = 0.0

@onready var status_label: Label = $UI/StatusLabel
@onready var log_label: Label = $UI/LogLabel
@onready var chat_input: LineEdit = $UI/ChatInput
@onready var chat_label: Label = $UI/ChatLabel

var sanctuary_pos := Vector2i(6, 6)
var sanctuary_npcs := [
	{"name": "Moss", "pos": Vector2i(4, 5)},
	{"name": "Hobo", "pos": Vector2i(8, 5)},
	{"name": "Tidekeeper", "pos": Vector2i(6, 8)}
]

func _ready() -> void:
	GameState.state_changed.connect(_on_state)
	GameState.hud_changed.connect(_refresh_hud)
	GameState.log_line.connect(_on_log)
	_refresh_hud()
	chat_input.text_submitted.connect(_on_chat_submitted)
	if GameState.phase == "SANCTUARY":
		status_label.text = "PHINHAVEN · Sanctuary | WASD to walk | Enter to enter The Shallows"
		chat_label.text = "Moss: The town is quiet. The depths are not."
	queue_redraw()

func _on_state(s: String) -> void:
	status_label.text = "Phase: %s" % s
	if s == "PLAY":
		_spawn()

func _on_log(t: String) -> void:
	log_label.text = t + "\n" + log_label.text

func _refresh_hud() -> void:
	if status_label:
		status_label.text = "HP %d | Fronds %d/%d | Kills %d/%d | %s" % [
			GameState.hp, GameState.fronds, GameState.CLEAR_FRONDS,
			GameState.kills, GameState.CLEAR_KILLS, GameState.phase
		]

func _spawn() -> void:
	nodes.clear()
	skitters.clear()
	px = 5
	py = 10
	for y in range(ROWS):
		for x in range(COLS):
			if map[y][x] == 2:
				nodes.append({"x": x, "y": y, "taken": false})
	var candidates: Array = []
	for y in range(1, ROWS - 1):
		for x in range(1, COLS - 1):
			if map[y][x] != 3 and not (x == px and y == py):
				candidates.append(Vector2i(x, y))
	for i in range(mini(6, candidates.size())):
		var idx := randi() % candidates.size()
		var c: Vector2i = candidates[idx]
		candidates.remove_at(idx)
		skitters.append({"x": c.x, "y": c.y, "hp": GameState.SKITTER_HP})
	queue_redraw()

func _process(delta: float) -> void:
	if GameState.phase == "SANCTUARY":
		if Input.is_action_just_pressed("ui_accept"):
			GameState.reset_run()
			_spawn()
			return
		var dx := 0
		var dy := 0
		if Input.is_action_pressed("move_up"):
			dy = -1
		elif Input.is_action_pressed("move_down"):
			dy = 1
		elif Input.is_action_pressed("move_left"):
			dx = -1
		elif Input.is_action_pressed("move_right"):
			dx = 1
		if dx != 0 or dy != 0:
			sanctuary_pos.x = clampi(sanctuary_pos.x + dx, 1, 14)
			sanctuary_pos.y = clampi(sanctuary_pos.y + dy, 2, 10)
			queue_redraw()
		return
	if GameState.phase != "PLAY" or GameState.busy:
		return
	if move_cd > 0.0:
		move_cd -= delta
		return
	var dx := 0
	var dy := 0
	if Input.is_action_pressed("move_up"):
		dy = -1
	elif Input.is_action_pressed("move_down"):
		dy = 1
	elif Input.is_action_pressed("move_left"):
		dx = -1
	elif Input.is_action_pressed("move_right"):
		dx = 1
	if dx != 0 or dy != 0:
		_try_move(dx, dy)

func _try_move(dx: int, dy: int) -> void:
	var nx := px + dx
	var ny := py + dy
	if nx < 0 or ny < 0 or nx >= COLS or ny >= ROWS:
		return
	if map[ny][nx] == 3:
		return
	for i in range(skitters.size()):
		var s: Dictionary = skitters[i]
		if int(s.x) == nx and int(s.y) == ny:
			_fight(i)
			return
	px = nx
	py = ny
	move_cd = 0.12
	for n in nodes:
		if not n.taken and int(n.x) == nx and int(n.y) == ny:
			n.taken = true
			var got := 1 + randi() % 2
			GameState.apply_gather(got)
			break
	queue_redraw()

func _fight(index: int) -> void:
	GameState.busy = true
	var s: Dictionary = skitters[index]
	var ehp: int = int(s.hp)
	var php: int = GameState.hp
	GameState.log_line.emit("Engaged Tide Skitter!")
	while ehp > 0 and php > 0:
		ehp -= GameState.PLAYER_DMG
		if ehp <= 0:
			break
		php -= GameState.SKITTER_DMG
	skitters.remove_at(index)
	GameState.busy = false
	GameState.apply_fight_result(php > 0, php)
	queue_redraw()

func _on_chat_submitted(text: String) -> void:
	var clean := text.strip_edges()
	if clean.is_empty():
		return
	chat_label.text = "You: " + clean + "\n" + chat_label.text
	chat_input.clear()

func _draw() -> void:
	if GameState.phase == "SANCTUARY":
		_draw_sanctuary()
		return
	for y in range(ROWS):
		for x in range(COLS):
			var t: int = map[y][x]
			var r := Rect2(x * TILE, y * TILE, TILE, TILE)
			match t:
				3:
					draw_rect(r, Color("1a3038"))
				1:
					draw_rect(r, Color("2a5a4a"))
				_:
					draw_rect(r, Color("1a4a5c") if (x + y) % 2 == 0 else Color("163d4a"))
	for n in nodes:
		if n.taken:
			continue
		var c := Vector2(n.x * TILE + TILE / 2.0, n.y * TILE + TILE / 2.0)
		draw_circle(c, 12.0, Color("2d6a4f"))
	for s in skitters:
		var c := Vector2(s.x * TILE + TILE / 2.0, s.y * TILE + TILE / 2.0)
		draw_circle(c, 11.0, Color("8b5a2b"))
	if GameState.phase == "PLAY" or GameState.phase == "CLEARED":
		var pc := Vector2(px * TILE + TILE / 2.0, py * TILE + TILE / 2.0)
		draw_circle(pc, 14.0, GameState.avatar_color)


func _draw_sanctuary() -> void:
	for y in range(12):
		for x in range(16):
			var r := Rect2(x * TILE, y * TILE, TILE, TILE)
			draw_rect(r, Color("10262b") if (x + y) % 2 == 0 else Color("123039"))
	for x in range(2, 14):
		draw_rect(Rect2(x * TILE, 3 * TILE, TILE, TILE), Color("31594d"))
	for y in range(4, 10):
		draw_rect(Rect2(6 * TILE, y * TILE, TILE, TILE), Color("31594d"))
	for npc in sanctuary_npcs:
		var p: Vector2i = npc.pos
		var pos := Vector2(p.x * TILE + TILE / 2.0, p.y * TILE + TILE / 2.0)
		draw_circle(pos, 13.0, Color("8b5a2b"))
		draw_string(ThemeDB.fallback_font, pos + Vector2(-22, -18), npc.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("e8e0c8"))
	var pc := Vector2(sanctuary_pos.x * TILE + TILE / 2.0, sanctuary_pos.y * TILE + TILE / 2.0)
	draw_circle(pc, 15.0, GameState.avatar_color)
	draw_string(ThemeDB.fallback_font, pc + Vector2(-18, 30), "YOU", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("ffffff"))
	draw_rect(Rect2(2 * TILE, 10 * TILE, 12 * TILE, TILE), Color("6b5635"))
	draw_string(ThemeDB.fallback_font, Vector2(3 * TILE, 10 * TILE + 30), "GUILD HALL / DEPTH BOARD", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("f1d27a"))
