import nuke
import os

toolbar = nuke.toolbar("Nodes")
gizmoskMenu = toolbar.addMenu('Custom Gizmos')

dirname = os.path.dirname(os.path.abspath(__file__))
pluginPath = os.path.join(dirname, 'gizmos')

def add_gizmos_to_menu(menu, folder):
    for entry in sorted(os.listdir(folder)):
        path = os.path.join(folder, entry)
        if os.path.isdir(path):
            submenu = menu.addMenu(entry)
            add_gizmos_to_menu(submenu, path)
        elif entry.endswith('.gizmo'):
            gizmo_name = os.path.splitext(entry)[0]
            menu.addCommand(gizmo_name, f'nuke.createNode("{gizmo_name}")')

if os.path.exists(pluginPath):
    add_gizmos_to_menu(gizmoskMenu, pluginPath)
else:
    nuke.message(f"Gizmos folder not found: {pluginPath}")