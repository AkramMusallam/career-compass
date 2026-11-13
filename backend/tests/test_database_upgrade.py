from sqlalchemy import create_engine, inspect, text

from app.core import database


def test_init_db_upgrades_existing_notification_preference(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text("INSERT INTO users (id) VALUES (1)"))
    monkeypatch.setattr(database, "engine", engine)
    database.init_db()
    database.init_db()
    cols = {column["name"] for column in inspect(engine).get_columns("users")}
    assert "notifications_opt_in" in cols
    assert "target_role" in cols
    with engine.connect() as connection:
        assert connection.execute(text("SELECT notifications_opt_in FROM users WHERE id = 1")).scalar_one() == 1
        assert connection.execute(text("SELECT target_role FROM users WHERE id = 1")).scalar_one() is None
    engine.dispose()
