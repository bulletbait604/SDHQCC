// Action class for advanced plugin development
// Provides a structured way to handle StreamDeck actions

class Action {
    constructor(uuid, action) {
        this.uuid = uuid;
        this.action = action;
        this.contexts = new Map();
    }

    addContext(context, settings = {}) {
        this.contexts.set(context, {
            settings: settings,
            state: 0
        });
    }

    removeContext(context) {
        this.contexts.delete(context);
    }

    updateSettings(context, settings) {
        if (this.contexts.has(context)) {
            const ctx = this.contexts.get(context);
            ctx.settings = { ...ctx.settings, ...settings };
            this.contexts.set(context, ctx);
        }
    }

    getSettings(context) {
        return this.contexts.get(context)?.settings || {};
    }

    setState(context, state) {
        if (this.contexts.has(context)) {
            this.contexts.get(context).state = state;
        }
    }

    getState(context) {
        return this.contexts.get(context)?.state || 0;
    }

    getAllContexts() {
        return Array.from(this.contexts.keys());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Action;
}
