/**
 * Constants for various buffer types in Pixi
 * @see BUFFER_TYPE
 * @name BUFFER_TYPE
 * @static
 * @enum {number}
 * @property {number} ELEMENT_ARRAY_BUFFER - buffer type for using as an index buffer
 * @property {number} ARRAY_BUFFER - buffer type for using attribute data
 * @property {number} UNIFORM_BUFFER - the buffer type is for uniform buffer objects
 */
export enum BUFFER_TYPE
{
    ELEMENT_ARRAY_BUFFER = 34963,
    ARRAY_BUFFER = 34962,
    UNIFORM_BUFFER = 35345,
}

export enum BUFFER_TYPE_EX
    // eslint-disable-next-line @typescript-eslint/indent
{
    COPY_READ_BUFFER = 0x8F36,
    COPY_WRITE_BUFFER = 0x8F37
}

