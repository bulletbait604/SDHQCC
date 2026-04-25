// Event definitions for StreamDeck WebSocket communication

const StreamDeckEvents = {
    // Device events
    DEVICE_DID_CONNECT: 'deviceDidConnect',
    DEVICE_DID_DISCONNECT: 'deviceDidDisconnect',
    
    // Action events
    WILL_APPEAR: 'willAppear',
    WILL_DISAPPEAR: 'willDisappear',
    KEY_DOWN: 'keyDown',
    KEY_UP: 'keyUp',
    KEY_PRESS: 'keyPress',
    
    // Settings events
    DID_RECEIVE_SETTINGS: 'didReceiveSettings',
    DID_RECEIVE_GLOBAL_SETTINGS: 'didReceiveGlobalSettings',
    
    // Title parameter events
    TITLE_PARAMETERS_DID_CHANGE: 'titleParametersDidChange',
    
    // Application events
    APPLICATION_DID_LAUNCH: 'applicationDidLaunch',
    APPLICATION_DID_TERMINATE: 'applicationDidTerminate',
    
    // System events
    SYSTEM_DID_WAKE_UP: 'systemDidWakeUp',
    PROPERTY_INSPECTOR_DID_APPEAR: 'propertyInspectorDidAppear',
    PROPERTY_INSPECTOR_DID_DISAPPEAR: 'propertyInspectorDidDisappear',
    SEND_TO_PLUGIN: 'sendToPlugin',
    SEND_TO_PROPERTY_INSPECTOR: 'sendToPropertyInspector'
};

// Event emitter helper
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    off(event, listener) {
        if (!this.events[event]) return;
        const idx = this.events[event].indexOf(listener);
        if (idx > -1) {
            this.events[event].splice(idx, 1);
        }
    }

    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(data));
    }

    once(event, listener) {
        const onceWrapper = (data) => {
            this.off(event, onceWrapper);
            listener(data);
        };
        this.on(event, onceWrapper);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StreamDeckEvents, EventEmitter };
}
