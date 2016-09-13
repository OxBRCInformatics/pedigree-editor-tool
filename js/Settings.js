/**
 * Created by soheil on 02/08/2016.
 */

Settings = Class.create({

	initialize: function (baseURL) {
		this._baseURL = baseURL ? baseURL : "http://localhost:8080/pedigree_editor";
		this._settings = config; //load it from config.js
	},

	getAbsoluteURL: function (url) {
		var _this = this;
		return _this._baseURL + url;
	},

	setLoaded: function () {
		this._loaded = true;
	},

	getSetting: function (key) {
		if (this._settings == undefined)
			alert("Settings are not loaded yet");
		return this._settings[key];
	}
});
