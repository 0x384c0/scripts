import nuke

toolbar = nuke.toolbar("Nodes")

gizmoskMenu = toolbar.addMenu('Custom Gizmos')
gizmoskMenu.addCommand('expoglow', 'nuke.createNode("expoglow")') 
gizmoskMenu.addCommand('FireflyKiller', 'nuke.createNode("FireflyKiller")') 
gizmoskMenu.addCommand('FlareFactory', 'nuke.createNode("FlareFactory")') 
gizmoskMenu.addCommand('K_LensEngine', 'nuke.createNode("K_LensEngine")') 
gizmoskMenu.addCommand('fl_VirtualLens', 'nuke.createNode("fl_VirtualLens")') 
gizmoskMenu.addCommand('SliceTool', 'nuke.createNode("SliceTool")') 
gizmoskMenu.addCommand('vignette_v2', 'nuke.createNode("vignette_v2")')

wptkMenu = gizmoskMenu.addMenu('World Position Tool Kit')
wptkMenu.addCommand('Mask3DCubical_ik', 'nuke.createNode("Mask3DCubical_ik")') 
wptkMenu.addCommand('Mask3DGradient_ik', 'nuke.createNode("Mask3DGradient_ik")') 
wptkMenu.addCommand('Mask3DSpherical_ik', 'nuke.createNode("Mask3DSpherical_ik")') 
wptkMenu.addCommand('TransformWorld_ik', 'nuke.createNode("TransformWorld_ik")') 
wptkMenu.addCommand('WorldPos_Texture_Projection_ik', 'nuke.createNode("WorldPos_Texture_Projection_ik")') 
wptkMenu.addCommand('WorldPos_Texture_Generator_ik', 'nuke.createNode("WorldPos_Texture_Generator_ik")') 
wptkMenu.addCommand('WorldPos_Lambert_Shader_ik', 'nuke.createNode("WorldPos_Lambert_Shader_ik")')
