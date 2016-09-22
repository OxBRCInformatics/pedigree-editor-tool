/*
 * HPOTerm is a class for storing phenotype information and loading it from the
 * the HPO database. These phenotypes can be attributed to an individual in the Pedigree.
 *
 * @param hpoId the id number for the HPO term, taken from the HPO database
 * @param name a string representing the name of the term e.g. "Abnormality of the eye"
 */
var HPOTerm = Class.create({

	initialize: function (hpoId, name, hpoPresent, valueAll, callWhenReady) {
		// user-defined terms
		if (name == null && !HPOTerm.isValidID(hpoId)) {
			name = hpoId;
		}


		//Added by Soheil for GEL(GenomicsEngland)
		if(valueAll == null || valueAll == undefined){
			valueAll = {};
		}
		this.valueAll = valueAll;
		this.hpoId = hpoId;
		this.name = name ? name : "loading...";

		if(this.valueAll && this.valueAll.hpoPresent == undefined){
			this.valueAll.hpoPresent = hpoPresent;
		}
		this.hpoPresent = hpoPresent;



		if (!name && callWhenReady)
			this.load(callWhenReady);
	},

	/*
	 * Returns the hpoId of the phenotype
	 */
	getID: function () {
		return this.hpoId;
	},

	getValueAll: function () {
		return this.valueAll;
	},
	/*
	 * Returns the name of the term
	 */
	getName: function () {
		return this.name;
	},

	load: function (callWhenReady) {
		//Comment added by Soheil for GEL(GenomicsEngland)
		//if we are here, it means that, the HPO details ie valueAll is not available
		//so we will load the details from HPO service
		var webService = new WebService();
		var baseOMIMServiceURL = webService.getHPOLookupPath();
		var queryURL           = baseOMIMServiceURL + "id=" + this.hpoId;

		//console.log("QueryURL: " + queryURL);
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
			console.log("LOADED HPO TERM: id = " + this.hpoId + ", name = " + parsed.rows[0].name);
			this.name = parsed.rows[0].name;
			//Added by Soheil for GEL(GenomicsEngland)
			this.valueAll = parsed.rows[0];
		} catch (err) {
			console.log("[LOAD HPO TERM] Error: " + err);
		}
	}
});

HPOTerm.isValidID = function (id) {
	var pattern = /^HP\:(\d)+$/i;
	return pattern.test(id);
}
