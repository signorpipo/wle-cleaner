import { ArrayToken, JSONAST, JSONTokenType, NumberToken, ObjectToken, StringToken } from '@playkostudios/jsonc-ast';
import { Type } from '@wonderlandengine/api';
import { type WLECleanerContext } from './WLECleanerContext.js';
import { cleanCompActive } from './cleanCompActive.js';
import { NATIVE_COMPONENTS, customCollisionExtentsOptsType, customCollisionRadiusOptsType, customOpaqueColorType, customPhysxCapsuleOptsType, customPhysxMeshOptsType, customVec3Type, customVec4Type } from './constants.js';
import { normalizeZeroOneToken } from './normalizeZeroOneToken.js';
import { parseEditorBundle } from './parseEditorBundle.js';
import { pruneOrGetComponentDependencies } from './pruneOrGetComponentDependencies.js';

/**
 * .wlp dependency tree:
 * object: object, mesh, material, texture, animation, skin
 * mesh: file
 * texture: file, image (implied if link and image not specified)
 * image: file
 * material: file, texture
 * shader: file
 * setting: object, material
 * animation: file
 * skin: file
 * pipeline: shader
 * file: -
 * font: file
 * language: - (maybe dont check this)
 *
 * check order: setting, object, animation, skin, mesh, font, language, material, texture, image, pipeline, shader, file
 */

export async function cleanupSingleProject(path: string, outputPath: string, editorBundlePath: string, editorBundleExtraPath: string | null) {
    // TODO dependency pruning

    // get bundle components
    const bundleComponents = parseEditorBundle(editorBundlePath, editorBundleExtraPath);

    // normalize default values of components and panic on unexpected properties
    for (const [compType, compConfig] of bundleComponents) {
        if (NATIVE_COMPONENTS.includes(compType)) {
            throw new Error(`Unexpected component with native name "${compType}" in editor bundle`);
        }

        for (const [propName, propConfig] of Object.entries(compConfig)) {
            if (propConfig.type !== Type.Enum) {
                continue;
            }

            if (propConfig.default === undefined) {
                if (!propConfig.values || propConfig.values.length === 0) {
                    throw new Error(`Enum property "${propName}" in component with native name "${compType}" has no values`);
                }

                propConfig.default = propConfig.values[0];
            }
        }
    }

    // add native components to bundle components. note that we can't automate
    // this because the properties of native components are defined with the
    // "Native" type, instead of a concrete type like "Int" or "Bool"
    bundleComponents.set('animation', {
        animation: { type: Type.Animation, default: null },
        playCount: { type: Type.Int, default: 0 },
        speed: { type: Type.Float, default: 1 },
        autoplay: { type: Type.Bool, default: false },
        retarget: { type: Type.Bool, default: false },
        preview: { type: Type.Bool, default: false },
    });

    // XXX CollisionComponents also work like component properties; they have
    //     a sphere property which is an object with a radius, an aabb and a box
    //     property which is an object with extents
    bundleComponents.set('collision', {
        groups: { type: Type.Int, default: 255 },
        collider: { type: Type.Enum, default: 'sphere', values: ['sphere', 'aabb', 'box'] },
        sphere: { type: customCollisionRadiusOptsType, default: 1 },
        aabb: { type: customCollisionExtentsOptsType, default: [1, 1, 1] },
        box: { type: customCollisionExtentsOptsType, default: [1, 1, 1] },
    });

    bundleComponents.set('input', {
        type: { type: Type.Enum, default: 'head', values: ['head', 'eye left', 'eye right', 'hand left', 'hand right', 'ray left', 'ray right'] },
    });

    bundleComponents.set('light', {
        type: { type: Type.Enum, default: 'point', values: ['point', 'spot', 'sun'] },
        color: { type: customOpaqueColorType, default: [1, 1, 1] },
        intensity: { type: Type.Float, default: 1 },
        outerAngle: { type: Type.Float, default: 90 },
        innerAngle: { type: Type.Float, default: 45 },
        shadows: { type: Type.Bool, default: false },
        shadowRange: { type: Type.Float, default: 10 },
        shadowBias: { type: Type.Float, default: 0.001 },
        shadowNormalBias: { type: Type.Float, default: 0.001 },
        shadowTexelSize: { type: Type.Float, default: 1 },
    });

    bundleComponents.set('mesh', {
        mesh: { type: Type.Mesh, default: null },
        material: { type: Type.Material, default: null },
        skin: { type: Type.Skin, default: null },
    });

    bundleComponents.set('physx', {
        shape: { type: Type.Enum, default: 'sphere', values: ['none', 'sphere', 'capsule', 'box', 'plane', 'convexMesh', 'triangleMesh'] },
        sphere: { type: customCollisionRadiusOptsType, default: 0.25 },
        capsule: { type: customPhysxCapsuleOptsType, default: { radius: 0.15, halfHeight: 0.25 } },
        box: { type: customCollisionExtentsOptsType, default: [0.25, 0.25, 0.25] },
        convexMesh: { type: customPhysxMeshOptsType, default: { mesh: null, scaling: [1, 1, 1] } },
        triangleMesh: { type: customPhysxMeshOptsType, default: { mesh: null, scaling: [1, 1, 1] } },
        allowSimulation: { type: Type.Bool, default: true },
        trigger: { type: Type.Bool, default: false },
        allowQuery: { type: Type.Bool, default: true },
        simulate: { type: Type.Bool, default: true },
        static: { type: Type.Bool, default: false },
        gravity: { type: Type.Bool, default: true },
        kinematic: { type: Type.Bool, default: false },
        mass: { type: Type.Float, default: 1 },
        linearDamping: { type: Type.Float, default: 1 },
        angularDamping: { type: Type.Float, default: 0.05 },
        staticFriction: { type: Type.Float, default: 0.5 },
        dynamicFriction: { type: Type.Float, default: 0.5 },
        bounciness: { type: Type.Float, default: 0.5 },
        groups: { type: Type.Int, default: 255 },
        block: { type: Type.Int, default: 255 },
        lockAxis: { type: Type.Int, default: 0 },
        solverPositionIterations: { type: Type.Int, default: 4 },
        solverVelocityIterations: { type: Type.Int, default: 1 },
        rotationOffset: { type: customVec4Type, default: [0, 0, 0, 1] },
        translationOffset: { type: customVec3Type, default: [0, 0, 0] },
    });

    bundleComponents.set('text', {
        alignment: { type: Type.Enum, default: 'center', values: ['left', 'center', 'right'] },
        verticalAlignment: { type: Type.Enum, default: 'middle', values: ['line', 'middle', 'top', 'bottom'] },
        characterSpacing: { type: Type.Float, default: 0 },
        lineSpacing: { type: Type.Float, default: 1.2 },
        effect: { type: Type.Enum, default: 'none', values: ['none', 'outline'] },
        text: { type: Type.String, default: 'Wonderland Engine' },
        material: { type: Type.Material }, // XXX no default; can't be auto-cleaned
    });

    bundleComponents.set('view', {
        fov: { type: Type.Float, default: 90 },
        near: { type: Type.Float, default: 0.01 },
        far: { type: Type.Float, default: 100 },
    });

    // parse project
    const ast = new JSONAST();
    const tkRoot = ObjectToken.assert((await ast.parse(path)).getValueToken());
    const tkObjects = ObjectToken.assert(tkRoot.getValueTokenOfKey('objects'));
    const tkMeshes = ObjectToken.assert(tkRoot.getValueTokenOfKey('meshes'));
    const tkTextures = ObjectToken.assert(tkRoot.getValueTokenOfKey('textures'));
    const tkImages = ObjectToken.assert(tkRoot.getValueTokenOfKey('images'));
    const tkMaterials = ObjectToken.assert(tkRoot.getValueTokenOfKey('materials'));
    const tkShaders = ObjectToken.assert(tkRoot.getValueTokenOfKey('shaders'));
    const tkSettings = ObjectToken.assert(tkRoot.getValueTokenOfKey('settings'));
    const tkAnimations = ObjectToken.assert(tkRoot.getValueTokenOfKey('animations'));
    const tkSkins = ObjectToken.assert(tkRoot.getValueTokenOfKey('skins'));
    const tkPipelines = ObjectToken.assert(tkRoot.getValueTokenOfKey('pipelines'));
    const tkFiles = ObjectToken.assert(tkRoot.getValueTokenOfKey('files'));
    const tkFonts = ObjectToken.assert(tkRoot.getValueTokenOfKey('fonts'));
    const tkLanguages = ObjectToken.assert(tkRoot.getValueTokenOfKey('languages'));

    // cleanup components and dependencies
    const context: WLECleanerContext = {
        cleanedDefaults: 0,
        cleanedInvalidComponents: 0,
        tkObjects, tkMeshes, tkTextures, tkImages, tkMaterials, tkShaders,
        tkSettings, tkAnimations, tkSkins, tkPipelines, tkFiles, tkFonts,
        tkLanguages,
    };

    // objects
    for (const [_objectID, tkObjectEntryGeneric] of tkObjects.getTokenEntries()) {
        const tkObjectEntry = ObjectToken.assert(tkObjectEntryGeneric);

        // check if object is linked
        const tkLinkGeneric = tkObjectEntry.maybeGetValueTokenOfKey('link');
        const isLinked = tkLinkGeneric !== null;
        let objectName;

        if (isLinked) {
            const tkLink = ObjectToken.assert(tkLinkGeneric);
            objectName = StringToken.assert(tkLink.getValueTokenOfKey('name')).evaluate();
            // TODO track dependency
        }

        const tkObjectNameGeneric = tkObjectEntry.maybeGetValueTokenOfKey('name');
        if (tkObjectNameGeneric) {
            objectName = StringToken.assert(tkObjectNameGeneric).evaluate();
        } else if (!objectName) {
            throw new Error(`Malformed object (missing name despite being unlinked)`);
        }

        // clean up components
        const tkComponentsGeneric = tkObjectEntry.maybeGetValueTokenOfKey('components');
        if (tkComponentsGeneric) {
            const tkComponents = ArrayToken.assert(tkComponentsGeneric);
            const tkComponentEntries = tkComponents.getTokenEntries();
            const tkComponentEntryCount = tkComponentEntries.length;
            let deletedEntryCount = 0;
            for (let t = tkComponentEntryCount - 1; t >= 0; t--) {
                const tkComponentGeneric = tkComponentEntries[t];
                if (tkComponentGeneric.type === JSONTokenType.Null) {
                    // remove null components if not linked; linked components
                    // can represent a mesh in a glb file which hasn't been
                    // "tweaked" yet (material changed, deactivated, etc...)
                    if (!isLinked) {
                        tkComponents.splice(t, 1);
                        deletedEntryCount++;
                    }

                    continue;
                }

                const tkComponent = ObjectToken.assert(tkComponentGeneric);
                // remove component if it has no type, unless it's a linked
                // component; linked components with no type can represent a
                // mesh from a glb file which has been, for example,
                // deactivated:
                // { active: false }
                const tkTypeGeneric = tkComponent.maybeGetValueTokenOfKey('type');
                if (!tkTypeGeneric) {
                    if (isLinked) {
                        for (const [compKey, tkValue] of tkComponent.getTokenEntries()) {
                            if (compKey === 'active') {
                                cleanCompActive(context, tkValue, tkComponent, null, objectName);
                                continue;
                            }

                            const tkComponentProperties = ObjectToken.assert(tkValue);
                            for (const [propKey, tkPropValue] of tkComponentProperties.getTokenEntries()) {
                                // FIXME should ! not be used here?
                                pruneOrGetComponentDependencies(context, bundleComponents.get(compKey)!, compKey, objectName, tkComponentProperties, propKey, tkPropValue);
                            }
                        }
                    } else {
                        console.warn(`Removed malformed component in object with name "${objectName}" (missing type)`);
                        tkComponents.splice(t, 1);
                        deletedEntryCount++;
                    }

                    continue;
                }

                // remove component with a type that is missing from the editor
                // bundle
                const compType = StringToken.assert(tkTypeGeneric).evaluate();
                const properties = bundleComponents.get(compType);
                if (!properties) {
                    console.warn(`Removed missing component with type "${compType}" from object with name "${objectName}"`);
                    tkComponents.splice(t, 1);
                    deletedEntryCount++;
                    continue;
                }

                // remove component properties that are no longer for the
                // current type
                for (const [compKey, tkValue] of tkComponent.getTokenEntries()) {
                    if (compKey === 'type') {
                        continue;
                    }

                    // remove "active" property if it's true (since it's already
                    // the default value)
                    if (compKey === 'active') {
                        cleanCompActive(context, tkValue, tkComponent, compType, objectName);
                        continue;
                    }

                    if (compKey === compType) {
                        // properties for current component type. remove if
                        // default or invalid key
                        const tkComponentProperties = ObjectToken.assert(tkValue);
                        for (const [propKey, tkPropValue] of tkComponentProperties.getTokenEntries()) {
                            pruneOrGetComponentDependencies(context, properties, compType, objectName, tkComponentProperties, propKey, tkPropValue);
                        }
                    } else {
                        // properties for component that is no longer the
                        // current type, remove
                        tkComponent.deleteKey(compKey);
                    }
                }
            }

            if (tkComponentEntryCount === deletedEntryCount) {
                tkObjectEntry.deleteKey('components');
            }
        }

        // clean up transforms if object is not linked (default values are
        // different for linked objects) or simplify them
        const tkTranslationGeneric = tkObjectEntry.maybeGetValueTokenOfKey('translation');
        if (tkTranslationGeneric) {
            const tkTranslation = ArrayToken.assert(tkTranslationGeneric);
            const tkNumParts = tkTranslation.getTokenEntries();
            if (tkNumParts.length !== 3) {
                throw new Error(`Expected "translation" to have 3 elements, ${tkNumParts.length} found in object with name "${objectName}"`);
            }

            let canReset = !isLinked;
            for (const tkNumPartGeneric of tkNumParts) {
                const tkNumPart = NumberToken.assert(tkNumPartGeneric);
                if (normalizeZeroOneToken(tkNumPart, tkTranslation) !== 0) {
                    canReset = false;
                }
            }

            if (canReset) {
                tkObjectEntry.deleteKey('translation');
            }
        }

        const tkScalingGeneric = tkObjectEntry.maybeGetValueTokenOfKey('scaling');
        if (tkScalingGeneric) {
            const tkScaling = ArrayToken.assert(tkScalingGeneric);
            const tkNumParts = tkScaling.getTokenEntries();
            if (tkNumParts.length !== 3) {
                throw new Error(`Expected "scaling" to have 3 elements, ${tkNumParts.length} found in object with name "${objectName}"`);
            }

            let canReset = !isLinked;
            for (const tkNumPartGeneric of tkNumParts) {
                const tkNumPart = NumberToken.assert(tkNumPartGeneric);
                if (normalizeZeroOneToken(tkNumPart, tkScaling) !== 1) {
                    canReset = false;
                }
            }

            if (canReset) {
                tkObjectEntry.deleteKey('scaling');
            }
        }

        const tkRotationGeneric = tkObjectEntry.maybeGetValueTokenOfKey('rotation');
        if (tkRotationGeneric) {
            const tkRotation = ArrayToken.assert(tkRotationGeneric);
            const tkNumParts = tkRotation.getTokenEntries();
            if (tkNumParts.length !== 4) {
                throw new Error(`Expected "rotation" to have 4 elements, ${tkNumParts.length} found in object with name "${objectName}"`);
            }

            let canReset = !isLinked;
            for (let i = 0; i < 4; i++) {
                const tkNumPart = NumberToken.assert(tkNumParts[i]);
                if (normalizeZeroOneToken(tkNumPart, tkRotation) !== (i === 3 ? 1 : 0)) {
                    canReset = false;
                }
            }

            if (canReset) {
                tkObjectEntry.deleteKey('rotation');
            }
        }
    }

    // compact empty project top-level JSON objects
    tkObjects.compactIfEmpty();
    tkMeshes.compactIfEmpty();
    tkTextures.compactIfEmpty();
    tkImages.compactIfEmpty();
    tkMaterials.compactIfEmpty();
    tkShaders.compactIfEmpty();
    tkSettings.compactIfEmpty();
    tkAnimations.compactIfEmpty();
    tkSkins.compactIfEmpty();
    tkPipelines.compactIfEmpty();
    // TODO compact files - it's an array, can't use compactIfEmpty
    tkFonts.compactIfEmpty();
    tkLanguages.compactIfEmpty();

    // write
    console.log(`Saving cleaned project in "${outputPath}"...`);
    await ast.writeToFile(outputPath);

    // display stats
    console.log(`Cleanup statistics:
 - Default values removed: ${context.cleanedDefaults}
 - Invalid components removed: ${context.cleanedInvalidComponents}\
`   );
}