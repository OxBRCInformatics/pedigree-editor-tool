/*
 * Disorder is a class for storing genetic disorder info and loading it from the
 * the OMIM database. These disorders can be attributed to an individual in the Pedigree.
 *
 * @param disorderID the id number for the disorder, taken from the OMIM database
 * @param name a string representing the name of the disorder e.g. "Down Syndrome"
 */
var Disorder = Class.create({

	initialize: function(disorderID, name, valueAll, callWhenReady) {
		// user-defined disorders
		if (name == null && !Helpers.isInt(disorderID)) {
			name = disorderID;
		}

		this._valueAll = valueAll;
		this._disorderID = disorderID;
		this._name = name ? name : "loading...";

		if (!name && callWhenReady)
			this.load(callWhenReady);
	},

	/*
	 * Returns the disorderID of the disorder
	 */
	getDisorderID: function () {
		return this._disorderID;
	},

	/*
	 * Returns the name of the disorder
	 */
	getName: function () {
		return this._name;
	},

	load: function (callWhenReady) {
		//Comment added by Soheil for GEL(GenomicsEngland)
		//if we are here, it means that, the disorder details ie _valueAll is not available
		//and the disorder list just has OMIM codes, so we will load the details from OMIM service
		var baseOMIMServiceURL = Disorder.getServiceURL("OMIM");
		var queryURL           = baseOMIMServiceURL + "&id=" + this._disorderID;

		//console.log("queryURL: " + queryURL);
		new Ajax.Request(queryURL, {
			method: "GET",
			onSuccess: this.onDataReady.bind(this),
			//onComplete: complete.bind(this)
			onComplete: callWhenReady ? callWhenReady : {}
		});
	},

	onDataReady: function (response) {
		try {
			var parsed = JSON.parse(response.responseText);
			//console.log(Helpers.stringifyObject(parsed));
			console.log("LOADED DISORDER: disorder id = " + this._disorderID + ", name = " + parsed.rows[0].name);
			this._name = parsed.rows[0].name;
			this._valueAll = parsed.rows[0];
		} catch (err) {
			console.log("[LOAD DISORDER] Error: " + err);
		}
	}
});

Disorder.getServiceURL = function(disorderType){
	var webservice = new WebService();

	if(disorderType == "OMIM"){
		return webservice.getOmimLookupPath();
	}else if(disorderType == "ICD10"){
		return webservice.getIcd10LookupPath();
	} else{
		return webservice.getOmimLookupPath();
	}
};
