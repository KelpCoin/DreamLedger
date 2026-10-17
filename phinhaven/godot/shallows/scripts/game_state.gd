extends Node
## Autoload: Floor 1 shared state. Offline-first; swap to RPC later.
## Numbers prefer ContentLoader / design JSON when available.

signal state_changed(new_state: String)
signal hud_changed
signal log_line(text: String)

var CLEAR_FRONDS: int = 6
var CLEAR_KILLS: int = 5
var MAX_HP: int = 10
var SKITTER_HP: int = 8
var SKITTER_DMG: int = 2
var PLAYER_DMG: int = 3

var phase: String = "SANCTUARY"  # SANCTUARY | PLAY | CLEARED | DEAD
var hp: int = 10
var fronds: int = 0
var kills: int = 0
var ever_cleared: bool = false
var avatar_color: Color = Color("4ecdc4")
var busy: bool = false

func _ready() -> void:
	_apply_design_numbers()
	hp = MAX_HP
	_load_local()
	hud_changed.emit()

func _apply_design_numbers() -> void:
	var data := ContentLoader.load_encounters()
	if data.is_empty():
		return
	var enemy: Dictionary = data.get("enemy_family", {})
	if enemy.has("hp_hint"):
		SKITTER_HP = int(enemy.hp_hint)
	if enemy.has("damage_hint"):
		SKITTER_DMG = int(enemy.damage_hint)
	for t in data.get("clear_targets", []):
		if typeof(t) != TYPE_DICTIONARY:
			continue
		match String(t.get("type", "")):
			"defeat_count":
				CLEAR_KILLS = int(t.get("count", CLEAR_KILLS))
			"gather_count":
				CLEAR_FRONDS = int(t.get("count", CLEAR_FRONDS))

func reset_run() -> void:
	hp = MAX_HP
	fronds = 0
	kills = 0
	busy = false
	phase = "PLAY"
	state_changed.emit(phase)
	hud_changed.emit()
	log_line.emit("Entered The Shallows. Kelp fringe. Tide Skitters nearby.")

func apply_gather(amount: int) -> void:
	if phase != "PLAY" or busy:
		return
	fronds += amount
	log_line.emit("Gathered %d Kelp Frond(s). (%d/%d)" % [amount, fronds, CLEAR_FRONDS])
	hud_changed.emit()
	_check_clear()

func apply_fight_result(player_won: bool, hp_after: int) -> void:
	hp = hp_after
	hud_changed.emit()
	if not player_won or hp <= 0:
		_die()
		return
	kills += 1
	log_line.emit("Skitter down. (%d/%d)" % [kills, CLEAR_KILLS])
	hud_changed.emit()
	_check_clear()

func _check_clear() -> void:
	if fronds >= CLEAR_FRONDS or kills >= CLEAR_KILLS:
		phase = "CLEARED"
		ever_cleared = true
		_save_local()
		var path := "gather path" if fronds >= CLEAR_FRONDS else "combat path"
		log_line.emit("CLEAR — The Shallows yields (%s). Local flag saved." % path)
		state_changed.emit(phase)
		hud_changed.emit()

func _die() -> void:
	fronds = 0
	busy = false
	phase = "DEAD"
	log_line.emit("DEATH — unbanked fronds lost. Cosmetics and clear flag kept.")
	state_changed.emit(phase)
	hud_changed.emit()
	# Stay in DEAD until player accepts return; do not silently flip to SANCTUARY.

func return_to_sanctuary() -> void:
	phase = "SANCTUARY"
	hp = MAX_HP
	fronds = 0
	kills = 0
	busy = false
	state_changed.emit(phase)
	hud_changed.emit()

func _save_local() -> void:
	var f := FileAccess.open("user://shallows_progress.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({
			"ever_cleared": ever_cleared,
			"avatar_color": avatar_color.to_html(false)
		}))

func _load_local() -> void:
	if not FileAccess.file_exists("user://shallows_progress.json"):
		return
	var f := FileAccess.open("user://shallows_progress.json", FileAccess.READ)
	if f:
		var data = JSON.parse_string(f.get_as_text())
		if typeof(data) == TYPE_DICTIONARY:
			ever_cleared = bool(data.get("ever_cleared", false))
			if data.has("avatar_color"):
				avatar_color = Color(str(data.avatar_color))
