/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable prefer-rest-params */
/**
 * https://github.com/primus/eventemitter3
 * LICENSE MIT
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
class Events
{
    [key: string | symbol]: any;
}

export type ValidEventTypes = string | symbol | object;

export type EventNames<T extends ValidEventTypes> = T extends string | symbol
    ? T
    : keyof T;

export type ArgumentMap<T extends object> = {
    [K in keyof T]: T[K] extends (...args: any[]) => void
        ? Parameters<T[K]>
        : T[K] extends any[]
            ? T[K]
            : any[];
};

export type EventListener<T extends ValidEventTypes,
    K extends EventNames<T>> = T extends string | symbol
        ? (...args: any[]) => void
        : (
            ...args: ArgumentMap<Exclude<T, string | symbol>>[Extract<K, keyof T>]
        ) => void;

export type EventArgs<T extends ValidEventTypes,
    K extends EventNames<T>> = Parameters<EventListener<T, K>>;

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
class EE
{
    constructor(public fn: any, public context: any, public once = false)
    {
    }
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener<T extends ValidEventTypes, Context>(emitter: EventEmitter<T, Context>,
    event: EventNames<T>, fn: Function, context: any, once: boolean): typeof emitter
{
    if (typeof fn !== 'function')
    {
        throw new TypeError('The listener must be a function');
    }

    var listener = new EE(fn, context || emitter, once);
    var evt = event;

    if (!emitter._events[evt])
    {
        emitter._events[evt] = listener;
        emitter._eventsCount++;
    }
    else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
    else emitter._events[evt] = [emitter._events[evt], listener];

    return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent<T extends ValidEventTypes>(emitter: EventEmitter<T>, evt: EventNames<T>)
{
    if (--emitter._eventsCount === 0) emitter._events = new Events();
    else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */

export class EventEmitter<EventTypes extends ValidEventTypes = string | symbol,
    Context = any>
{
    _events = new Events();
    _eventsCount = 0;

    /**
     * Return an array listing the events for which the emitter has registered
     * listeners.
     *
     * @returns {Array}
     * @public
     */
    eventNames(): Array<EventNames<EventTypes>>
    {
        var names: any[] = [];
        var events;
        var name;

        if (this._eventsCount === 0) return names;

        for (name in (events = this._events))
        {
            if (has.call(events, name)) names.push(name);
        }

        if (Object.getOwnPropertySymbols)
        {
            return names.concat(Object.getOwnPropertySymbols(events));
        }

        return names;
    }

    /**
     * Return the listeners registered for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Array} The registered listeners.
     * @public
     */
    listeners<T extends EventNames<EventTypes>>(
        event: T
    ): Array<EventListener<EventTypes, T>>
    {
        var evt = event;
        var handlers = this._events[evt];

        if (!handlers) return [];
        if (handlers.fn) return [handlers.fn];

        var l = handlers.length;
        var ee = new Array(l);

        for (var i = 0; i < l; i++)
        {
            ee[i] = handlers[i].fn;
        }

        return ee;
    }

    /**
     * Return the number of listeners listening to a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Number} The number of listeners.
     * @public
     */
    listenerCount(event: EventNames<EventTypes>)
    {
        var evt = event;
        var listeners = this._events[evt];

        if (!listeners) return 0;
        if (listeners.fn) return 1;

        return listeners.length;
    }

    /**
     * Calls each of the listeners registered for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Boolean} `true` if the event had listeners, else `false`.
     * @public
     */
    emit<T extends EventNames<EventTypes>>(
        event: T,
        a1?: any, // EventArgs<EventTypes, T>,
        a2?: any, // EventArgs<EventTypes, T>,
        a3?: any, // EventArgs<EventTypes, T>,
        a4?: any, // EventArgs<EventTypes, T>,
        a5?: any, // EventArgs<EventTypes, T>
    ): boolean
    {
        var evt = event;

        if (!this._events[evt]) return false;

        var listeners = this._events[evt];
        var len = arguments.length;
        var args;
        var i;

        if (listeners.fn)
        {
            if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

            switch (len)
            {
                case 1:
                    listeners.fn.call(listeners.context);
                    break;
                case 2:
                    listeners.fn.call(listeners.context, a1);
                    break;
                case 3:
                    listeners.fn.call(listeners.context, a1, a2);
                    break;
                case 4:
                    listeners.fn.call(listeners.context, a1, a2, a3);
                    break;
                case 5:
                    listeners.fn.call(listeners.context, a1, a2, a3, a4);
                    break;
                case 6:
                    listeners.fn.call(listeners.context, a1, a2, a3, a4, a5);
                    break;
                default:
                    for (i = 1, args = new Array(len - 1); i < len; i++)
                    {
                        args[i - 1] = arguments[i];
                    }

                    listeners.fn.apply(listeners.context, args);
            }
        }
        else
        {
            var length = listeners.length;
            var j;

            for (i = 0; i < length; i++)
            {
                if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

                switch (len)
                {
                    case 1:
                        listeners[i].fn.call(listeners[i].context);
                        break;
                    case 2:
                        listeners[i].fn.call(listeners[i].context, a1);
                        break;
                    case 3:
                        listeners[i].fn.call(listeners[i].context, a1, a2);
                        break;
                    case 4:
                        listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                        break;
                    default:
                        if (!args)
                        {
                            for (j = 1, args = new Array(len - 1); j < len; j++)
                            {
                                args[j - 1] = arguments[j];
                            }
                        }

                        listeners[i].fn.apply(listeners[i].context, args);
                }
            }
        }

        return true;
    }

    /**
     * Add a listener for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     */
    on<T extends EventNames<EventTypes>>(
        event: T,
        fn: EventListener<EventTypes, T>,
        context?: Context
    ): this
    {
        addListener(this, event, fn, context, false);

        return this;
    }

    /**
     * Add a one-time listener for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     */
    once<T extends EventNames<EventTypes>>(
        event: T,
        fn: EventListener<EventTypes, T>,
        context?: Context
    ): this
    {
        addListener(this, event, fn, context, true);

        return this;
    }

    /**
     * Remove the listeners of a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn Only remove the listeners that match this function.
     * @param {*} context Only remove the listeners that have this context.
     * @param {Boolean} once Only remove one-time listeners.
     * @returns {EventEmitter} `this`.
     * @public
     */
    removeListener<T extends EventNames<EventTypes>>(
        event: T,
        fn?: EventListener<EventTypes, T>,
        context?: Context,
        once?: boolean
    ): this
    {
        var evt = event;

        if (!this._events[evt]) return this;
        if (!fn)
        {
            clearEvent(this, evt);

            return this;
        }

        var listeners = this._events[evt];

        if (listeners.fn)
        {
            if (
                listeners.fn === fn
                && (!once || listeners.once)
                && (!context || listeners.context === context)
            )
            {
                clearEvent(this, evt);
            }
        }
        else
        {
            var events: any[] = [];

            for (var i = 0, length = listeners.length; i < length; i++)
            {
                if (
                    listeners[i].fn !== fn
                    || (once && !listeners[i].once)
                    || (context && listeners[i].context !== context)
                )
                {
                    events.push(listeners[i]);
                }
            }

            //
            // Reset the array, or remove it completely if we have no more listeners.
            //
            if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
            else clearEvent(this, evt);
        }

        return this;
    }

    /**
     * Remove all listeners, or those of the specified event.
     *
     * @param {(String|Symbol)} [event] The event name.
     * @returns {EventEmitter} `this`.
     * @public
     */
    removeAllListeners(event?: EventNames<EventTypes>)
    {
        var evt: EventNames<EventTypes>;

        if (event)
        {
            evt = event;
            if (this._events[evt]) clearEvent(this, evt);
        }
        else
        {
            this._events = new Events();
            this._eventsCount = 0;
        }

        return this;
    }

    //
    // Alias methods names because people roll like that.
    //
    off<T extends EventNames<EventTypes>>(event: T,
        fn?: EventListener<EventTypes, T>,
        context?: Context,
        once?: boolean)
    {
        return this.removeListener(event, fn, context, once);
    }

    addListener<T extends EventNames<EventTypes>>(
        event: T,
        fn: EventListener<EventTypes, T>,
        context?: Context
    ): this
    {
        addListener(this, event, fn, context, true);

        return this;
    }
}
