extends RefCounted
class_name ContentLoader
## Loads Floor 1 design JSON (same numbers as browser MVP / PROOF data).

static func load_encounters() -> Dictionary:
	var path := "res://data/the_shallows_encounters.json"
	if not FileAccess.file_exists(path):
		return _fallback()
	var f := FileAccess.open(path, FileAccess.READ)
	var data = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_DICTIONARY:
		return _fallback()
	return data

static func _fallback() -> Dictionary:
	return {
		"floor_id": 1,
		"name": "The Shallows",
		"clear_targets": [
			{"type": "defeat_count", "count": 5},
			{"type": "gather_count", "count": 6}
		],
		"enemy_family": {"id": "tide_skitter", "hp_hint": 8, "damage_hint": 2}
	}
