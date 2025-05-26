import { ArrayToken, JSONTokenType, NumberToken, StringToken, type JSONValueToken, type ObjectToken } from '@playkostudios/jsonc-ast';
import { Type } from '@wonderlandengine/api';
import { customCollisionExtentsOptsType, customCollisionRadiusOptsType, customOpaqueColorType, customPhysxCapsuleOptsType, customPhysxMeshOptsType, customVec3Type, customVec4Type } from './constants.js';
import { type ModifiedComponentPropertyRecord } from './ModifiedComponentProperty.js';
import { type WLECleanerContext } from './WLECleanerContext.js';

export function pruneOrGetComponentDependencies(context: WLECleanerContext, properties: ModifiedComponentPropertyRecord, compType: string, objectName: string, tkComponentProperties: ObjectToken, propKey: string, tkPropValue: JSONValueToken) {
    // TODO only remove defaults if --prune-defaults is used
    const propConfig = properties[propKey];
    if (propConfig === undefined) {
        console.warn(`Invalid component property "${propKey}" removed for component with type "${compType}" from object with name "${objectName}"`);
        tkComponentProperties.deleteKey(propKey);
        context.cleanedInvalidComponents++;
        return;
    }

    const canPruneDefault = propConfig.default !== undefined;
    let isDefault = false;

    if (propConfig.type === Type.Native) {
        console.warn(`Ignored native property "${propKey}" for component with type "${compType}" from object with name "${objectName}"`);
    } else if (propConfig.type === Type.Bool) {
        if (tkPropValue.type === JSONTokenType.False || tkPropValue.type === JSONTokenType.True) {
            if (canPruneDefault) {
                isDefault = tkPropValue.evaluate() === propConfig.default;
            }
        } else {
            throw new Error(`Unexpected property value for component property "${propKey}" from component with type "${compType}" from object with name "${objectName}"`);
        }
    } else if (propConfig.type === Type.Int || propConfig.type === Type.Float) {
        if (canPruneDefault) {
            isDefault = NumberToken.assert(tkPropValue).evaluate() === propConfig.default;
        }
    } else if (propConfig.type === Type.String || propConfig.type === Type.Enum) {
        if (canPruneDefault) {
            isDefault = StringToken.assert(tkPropValue).evaluate() === propConfig.default;
        }
    } else if (propConfig.type === Type.Mesh) {
        // TODO track dependency
    } else if (propConfig.type === Type.Texture) {
        // TODO track dependency
    } else if (propConfig.type === Type.Material) {
        // TODO track dependency
    } else if (propConfig.type === Type.Animation) {
        // TODO track dependency
    } else if (propConfig.type === Type.Skin) {
        // TODO track dependency
    } else if (propConfig.type === Type.Color || propConfig.type === customOpaqueColorType || propConfig.type === customVec3Type || propConfig.type === customVec4Type) {
        if (canPruneDefault) {
            const expectedLen = (propConfig.type === Type.Color || propConfig.type === customVec4Type) ? 4 : 3;
            const arr = ArrayToken.assert(tkPropValue).evaluate();

            if (arr.length !== expectedLen) {
                throw new Error(`Unexpected vector length (expected ${expectedLen}, got ${arr.length}) for component property "${propKey}" from component with type "${compType}" from object with name "${objectName}"`);
            }

            isDefault = true;
            for (let i = 0; i < expectedLen; i++) {
                if (arr[i] !== propConfig.default[i]) {
                    isDefault = false;
                    break;
                }
            }
        }
    } else if (propConfig.type === customCollisionRadiusOptsType) {
        // TODO
    } else if (propConfig.type === customCollisionExtentsOptsType) {
        // TODO
    } else if (propConfig.type === customPhysxCapsuleOptsType) {
        // TODO
    } else if (propConfig.type === customPhysxMeshOptsType) {
        // TODO track dependency

        // TODO prune default
    } else if (propConfig.type !== Type.Object) {
        let typeIDName: string | unknown = propConfig.type;
        if (typeof typeIDName !== 'string') {
            typeIDName = `<internal wle-cleaner ID (${String(typeIDName)})>`;
        }

        throw new Error(`Unexpected property type ID "${typeIDName}" for component property "${propKey}" from component with type "${compType}" from object with name "${objectName}"`);
    }

    if (isDefault) {
        // default value, remove
        tkComponentProperties.deleteKey(propKey);
        context.cleanedDefaults++;
    }
}