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

func _ready() -> void:
	GameState.state_changed.connect(_on_state)
	GameState.hud_changed.connect(_refresh_hud)
	GameState.log_line.connect(_on_log)
	_refresh_hud()
	if GameState.phase == "SANCTUARY":
		status_label.text = "Sanctuary — press Enter / Space to enter The Shallows"

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

func _draw() -> void:
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
