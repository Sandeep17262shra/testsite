/**
 * glbGemCharms.js - the four 3D gem charms (Princess, Pear Petal, Elephant, Camel).
 *
 * One place for how each hangs, in BRACELET units; the necklace draws the very
 * same charm at NECKLACE_GLB_CHARM_SCALE times the size. Edit a value here and
 * both the bracelet and the necklace follow.
 *
 *   scale      model -> scene scale on the bracelet
 *   rotation   turns the model so its bail points back at the chain
 *   offset     nudge of the model from the chain anchor [x, y, z]
 *   bail       the bail ring: radius, wire thickness and where it sits
 */
export const GEM_GLB_CHARMS = [
  {
    id: "princess", icon: "/bc-assets/images/charms/princess_charm.webp", path: "/bc-assets/bracelet_models/princess.glb", name: "Princess Charm", price: 130,
    scale: [0.009, 0.009, 0.009], rotation: [Math.PI / 2, Math.PI, 0], offset: [0, -0.5, 0.11],
    bail: { ringR: 0.025, ringTube: 0.003, offset: [0, 0.075, -0.06] },
  },
  {
    id: "patel", icon: "/bc-assets/images/charms/peacock_feather_charm.webp", path: "/bc-assets/bracelet_models/patel.glb", name: "Pear Petal Charm", price: 130,
    scale: [0.025, 0.025, 0.025], rotation: [Math.PI / 2, 0, 0], offset: [0, -0.2, 0.05],
    bail: { ringR: 0.03, ringTube: 0.003, offset: [0.005, 0.125, -0.02] },
  },
  {
    id: "elephant", icon: "/bc-assets/images/charms/elephant_charm.webp", path: "/bc-assets/bracelet_models/elephant.glb", name: "Elephant Charm", price: 130,
    scale: [0.012, 0.012, 0.012], rotation: [-Math.PI / 2, 0, 0], offset: [-0.03, -0.14, 0],
    bail: { ringR: 0.04, ringTube: 0.005, offset: [0.03, 0.1, 0.04] },
  },
  {
    id: "camel", icon: "/bc-assets/images/charms/camel_charm.webp", path: "/bc-assets/bracelet_models/camel.glb", name: "Camel Charm", price: 130,
    scale: [0.013, 0.013, 0.013], rotation: [-Math.PI / 2, 0, 0], offset: [0.03, -0.14, 0],
    bail: { ringR: 0.03, ringTube: 0.005, offset: [-0.02, 0.09, 0.04] },
  },
];
export const getGemGlbCharm = (path) => GEM_GLB_CHARMS.find((c) => c.path === path) || null;
export const getGemGlbCharmId = (path) => getGemGlbCharm(path)?.id ?? null;

// Necklace units per bracelet unit (an initial's letter is 0.55 there, 0.11 here).
export const NECKLACE_GLB_CHARM_SCALE = 5;
export const DEFAULT_GEM_GLB_STONE_COLOR = "#F4F8FF";
