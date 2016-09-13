/**
 * Created by soheil on 02/08/2016.
 */

WebService = Class.create({

	initialize: function () {
		this._settings = new Settings();
		this._baseURL = this._settings.getSetting('codingDefinitionServiceEndpoint');
	},

	getOmimLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/OMIMLookupService?";
	},

	getIcd10LookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/ICDLookupService?";
	},

	getSnomedCTLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/SNOMEDCTLookupService?";
	},

	getEthnicityLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/Ethnicity?";
	},

	getHPOLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/OntologyService/LookupService?";
	},

	getDiagramEndpointPath: function(){
		var config = this._settings.getSetting('diagramEndpoint');
		switch(config.service){
			case "mercury":
				return "???";
				break;
			case "openclinica":
				var eventCRFId = this.getUrlParameter("eventCRFId");
				var status = this.getUrlParameter("status");
				var participantId = this.getUrlParameter("participantId");
				return "/openclinica/pedigree/get?eventCRFId=" + eventCRFId + "&status=" + status + "&participantId=" + participantId;
			case "local":
				return null;
		}
	},

	getUrlParameter: function getUrlParameter(sParam) {
		var sPageURL = decodeURIComponent(window.location.search.substring(1)),
			sURLVariables = sPageURL.split('&'),
			sParameterName,
			i;

		for (i = 0; i < sURLVariables.length; i++) {
			sParameterName = sURLVariables[i].split('=');

			if (sParameterName[0] === sParam) {
				return sParameterName[1] === undefined ? true : sParameterName[1];
			}
		}
	}

});