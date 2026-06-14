from snapic.db.repository import (
    _normalize_matched_person,
    _normalize_optional_score,
    _normalize_score,
    _parse_utc_datetime,
)


def test_parse_utc_datetime_handles_z_suffix():
    dt = _parse_utc_datetime("2026-06-01T12:00:00Z")
    assert dt is not None
    assert dt.tzinfo is not None


def test_parse_utc_datetime_handles_naive_timestamp():
    dt = _parse_utc_datetime("2026-06-01T12:00:00")
    assert dt is not None
    assert dt.tzinfo is not None


def test_normalize_matched_person_coerces_db_text_values():
    assert _normalize_matched_person("1") == 1
    assert _normalize_matched_person("2") == 2
    assert _normalize_matched_person("both") == "both"
    assert _normalize_matched_person(None) is None


def test_normalize_score_clamps_to_unit_interval():
    assert _normalize_score(1.05) == 1.0
    assert _normalize_optional_score(None) is None
