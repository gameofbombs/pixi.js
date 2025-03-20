import { Texture } from '../../../rendering';
import { getCanvasBoundingBox, updateQuadBounds } from '../../../utils';
import { type BatchableSprite } from '../../sprite/BatchableSprite';
import { type AbstractText } from '../AbstractText';

import type { Rectangle } from '../../../maths';
import type { PaddingSides } from '../PaddingSides';

/**
 * Updates the bounds of the given batchable sprite based on the provided text object.
 *
 * This function adjusts the bounds of the batchable sprite to match the dimensions
 * and anchor point of the text's texture. Additionally, it compensates for any padding
 * specified in the text's style to ensure the text is rendered correctly on screen.
 * @param {BatchableSprite} batchableSprite - The sprite whose bounds need to be updated.
 * @param {AbstractText} text - The text object containing the texture and style information.
 */
export function updateTextBounds(batchableSprite: BatchableSprite, text: AbstractText)
{
    const { texture, bounds } = batchableSprite;

    updateQuadBounds(bounds, text._anchor, texture);
}

export function adjustTextTexture(texture: Texture, padding: PaddingSides, do_trim = false)
{
    if (!padding && !do_trim)
    {
        return;
    }
    const orig = texture.frame.clone();

    orig.width -= padding.vertical;
    orig.height -= padding.horizontal;

    if (do_trim)
    {
        const trimmed = getCanvasBoundingBox(texture.source.resource, texture.source.resolution);

        texture.frame.copyFrom(trimmed);
        texture.updateUvs();
    }

    let trim: Rectangle = texture.frame;

    if (padding)
    {
        trim = trim.clone();
        trim.x -= padding.left;
        trim.y -= padding.top;
    }

    texture.setOrigTrim(orig, trim);
}
