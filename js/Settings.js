/**
 * Created by soheil on 02/08/2016.
 */

Settings = Class.create({

    initialize: function (baseURL) {
        this._baseURL = baseURL ? baseURL : "";
        this._settings = undefined;
        this._loaded = false;
    },

    getAbsoluteURL: function (url) {
        var _this = this;
        return _this._baseURL + url;
    },
    load: function (callWhenReady) {
        // new Ajax.Request('rest/config.json', {
        //     method: "GET",
        //     onSuccess: this.onConfigReady.bind(this),
        //     onFailure: function(response){
        //         console.log(">> Could not load config "+ response)
        //     },
        //     onException: function(response){
        //         console.log(">> Could not load config "+ response)
        //     },
        //     onComplete: callWhenReady ? callWhenReady : {}
        // });

        var response = {
            responseJSON: {
                "codingDefinitionServiceEndpoint": "/codingDefinitionService",
                "diagramEndpoint": {
//    "service": "mercury",
//    "service": "openclinica",
                    "service": "local"
                }
            }
        };
        this.onConfigReady(response);
    },
    onConfigReady: function (response) {
        this._settings = response.responseJSON;
        this.setLoaded();
        console.log(">> config " + stringifyObject(this._settings));
    },
    setLoaded: function () {
        this._loaded = true;
    },
    getSetting: function (key) {
        if (!this._loaded) this.load(this.setLoaded.bind(this));
        if (this._settings == undefined) alert("Settings are not loaded yet");
        return this._settings[key];
    }


});