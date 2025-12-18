"""
Unit tests for main module.
"""

import pytest

from src.main import main


class TestMain:
    """Tests for the main function."""

    def test_main_returns_zero(self) -> None:
        """Test that main returns 0 on success."""
        result = main()
        assert result == 0

    def test_main_prints_message(self, capsys: pytest.CaptureFixture) -> None:
        """Test that main prints the expected message."""
        main()
        captured = capsys.readouterr()
        assert "Application started successfully" in captured.out
