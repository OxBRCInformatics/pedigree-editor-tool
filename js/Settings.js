/**
 * Created by soheil on 02/08/2016.
 */

Settings = Class.create({

	initialize: function (baseURL) {
		this._settings = config; //'config' is a global variable load it from config.js
	},

	getSetting: function (key) {
		if (this._settings == undefined)
			alert("Settings are not loaded yet");
		return this._settings[key];
	}
});
