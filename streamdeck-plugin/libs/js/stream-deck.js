var $SD = (function () {
    'use strict';

    var callbacks = {};
    var websocket = null;
    var uuid = '';
    var inInfo = null;
    var actionInfo = null;

    function connect(socket, inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
        uuid = inUUID;
        actionInfo = JSON.parse(inActionInfo);
        inInfo = JSON.parse(inInfo);

        websocket = new WebSocket('ws://127.0.0.1:' + inPort);

        websocket.onopen = function () {
            var json = {
                event: inRegisterEvent,
                uuid: inUUID
            };
            websocket.send(JSON.stringify(json));

            if (callbacks.onConnected) {
                callbacks.onConnected({
                    actionInfo: actionInfo,
                    appInfo: inInfo,
                    connection: websocket,
                    messageType: inRegisterEvent,
                    port: inPort,
                    uuid: inUUID
                });
            }
        };

        websocket.onmessage = function (evt) {
            var jsonObj = JSON.parse(evt.data);
            var event = jsonObj.event;

            if (callbacks[event]) {
                callbacks[event](jsonObj);
            }
        };

        websocket.onclose = function () {
            if (callbacks.onDisconnected) {
                callbacks.onDisconnected();
            }
        };
    }

    function on(event, callback) {
        callbacks[event] = callback;
    }

    function send(message) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(message));
        }
    }

    return {
        connect: connect,
        on: on,
        send: send,
        uuid: function () { return uuid; },
        actionInfo: function () { return actionInfo; },
        info: function () { return inInfo; },
        
        // Event shortcuts
        onWillAppear: function (callback) { on('willAppear', callback); },
        onWillDisappear: function (callback) { on('willDisappear', callback); },
        onKeyDown: function (callback) { on('keyDown', callback); },
        onKeyUp: function (callback) { on('keyUp', callback); },
        onDidReceiveSettings: function (callback) { on('didReceiveSettings', callback); },
        onDidReceiveGlobalSettings: function (callback) { on('didReceiveGlobalSettings', callback); },
        onConnected: function (callback) { callbacks.onConnected = callback; },
        onDisconnected: function (callback) { callbacks.onDisconnected = callback; },

        // Actions
        setSettings: function (settings) {
            send({ event: 'setSettings', context: uuid, payload: settings });
        },
        getSettings: function () {
            send({ event: 'getSettings', context: uuid });
        },
        setGlobalSettings: function (settings) {
            send({ event: 'setGlobalSettings', context: uuid, payload: settings });
        },
        getGlobalSettings: function () {
            send({ event: 'getGlobalSettings', context: uuid });
        },
        openUrl: function (url) {
            send({ event: 'openUrl', payload: { url: url } });
        },
        logMessage: function (message) {
            send({ event: 'logMessage', payload: { message: message } });
        },
        setTitle: function (context, title) {
            send({ event: 'setTitle', context: context, payload: { title: title } });
        },
        setImage: function (context, image) {
            send({ event: 'setImage', context: context, payload: { image: image } });
        },
        setState: function (context, state) {
            send({ event: 'setState', context: context, payload: { state: state } });
        },
        showAlert: function (context) {
            send({ event: 'showAlert', context: context });
        },
        showOk: function (context) {
            send({ event: 'showOk', context: context });
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = $SD;
}
