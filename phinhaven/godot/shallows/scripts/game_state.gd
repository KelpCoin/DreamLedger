extends Node
## Autoload: shared Floor 1 state. Offline-first; swap to RPC later.

signal state_changed(new_state: String)
signal hud_changed
signal log_line(text: String)

const CLEAR_FRONDS := 6
const CLEAR_KILLS := 5
const MAX_HP := 10
const SKITTER_HP := 8
const SKITTER_DMG := 2
const PLAYER_DMG := 3

var phase: String = "SANCTUARY"  # SANCTUARY | PLAY | CLEARED | DEAD
var hp: int = MAX_HP
var fronds: int = 0
var kills: int = 0
var ever_cleared: bool = false
var avatar_color: Color = Color("4ecdc4")
var busy: bool = false

func _ready() -> void:
	_load_local()

func reset_run() -> void:
	hp = MAX_HP
	fronds = 0
	kills = 0
	busy = false
	phase = "PLAY"
	state_changed.emit(phase)
	hud_changed.emit()
	log_line.emit("Entered The Shallows.")

func apply_gather(amount: int) -> void:
	if phase != "PLAY" or busy:
		return
	fronds += amount
	log_line.emit("Gathered %d Kelp Frond(s). (%d/%d)" % [amount, fronds, CLEAR_FRONDS])
	hud_changed.emit()
	_check_clear()

func apply_fight_result(player_won: bool, hp_after: int) -> void:
	hp = hp_after
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
		log_line.emit("CLEAR — tide line shifts (local flag).")
		state_changed.emit(phase)
		hud_changed.emit()

func _die() -> void:
	fronds = 0
	phase = "DEAD"
	log_line.emit("DEATH — unbanked fronds lost.")
	state_changed.emit(phase)
	hud_changed.emit()
	# Return to sanctuary presentation; caller may change scene
	phase = "SANCTUARY"
	hp = MAX_HP
	state_changed.emit(phase)

func _save_local() -> void:
	var f := FileAccess.open("user://shallows_progress.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"ever_cleared": ever_cleared}))

func _load_local() -> void:
	if not FileAccess.file_exists("user://shallows_progress.json"):
		return
	var f := FileAccess.open("user://shallows_progress.json", FileAccess.READ)
	if f:
		var data = JSON.parse_string(f.get_as_text())
		if typeof(data) == TYPE_DICTIONARY and data.get("ever_cleared", false):
			ever_cleared = true
