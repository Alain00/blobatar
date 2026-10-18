"""Root conftest — adds the package to sys.path."""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
