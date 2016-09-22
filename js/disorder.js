/*
 * Disorder is a class for storing genetic disorder info and loading it from the
 * the OMIM database. These disorders can be attributed to an individual in the Pedigree.
 *
 * @param disorderID the id number for the disorder, taken from the OMIM database
 * @param name a string representing the name of the disorder e.g. "Down Syndrome"
 */
var Disorder = Class.create({

	//pass valueAll
	//this parameter is added by Soheil for GEL(GenomicsEngland)
	initialize: function(disorderId, name, ageOfOnset, disorderType, valueAll, callWhenReady) {
		// user-defined disorders
		if (name == null && !Helpers.isInt(disorderId)) {
			name = disorderId;
		}

		//Added by Soheil for GEL(GenomicsEngland)
		if(valueAll == null || valueAll == undefined){
			valueAll = {};
		}
		this.valueAll = valueAll;
		this.disorderId = disorderId;
		this.name = name ? name : "loading...";

		if(this.valueAll && this.valueAll.ageOfOnset == undefined){
			this.valueAll.ageOfOnset = ageOfOnset;
		}
		this.ageOfOnset = ageOfOnset;


		if(this.valueAll && this.valueAll.disorderType == undefined){
			this.valueAll.disorderType = disorderType;
		}
		this.disorderType = disorderType;


		if (!name && callWhenReady)
			this.load(callWhenReady);
	},

	/*
	 * Returns the disorderId of the disorder
	 */
	getDisorderId: function () {
		return this.disorderId;
	},

	/*
	 * Returns the name of the disorder
	 */
	getName: function () {
		return this.name;
	},


	getValueAll: function () {
		return this.valueAll;
	},

	load: function (callWhenReady) {
		//Comment added by Soheil for GEL(GenomicsEngland)
		//if we are here, it means that, the disorder details ie valueAll is not available
		//and the disorder list just has OMIM codes, so we will load the details from OMIM service
		var baseOMIMServiceURL = Disorder.getServiceURL("OMIM");
		var queryURL           = baseOMIMServiceURL + "&id=" + this.disorderId;

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
			console.log("LOADED DISORDER: disorder id = " + this.disorderId + ", name = " + parsed.rows[0].name);
			this.name = parsed.rows[0].name;
			//Added by Soheil for GEL(GenomicsEngland)
			this.valueAll = parsed.rows[0];
		} catch (err) {
			console.log("[LOAD DISORDER] Error: " + err);
		}
	}
});

//Added by Soheil for GEL(GenomicsEngland)
Disorder.getServiceURL = function(disorderType){
	var webservice = new WebService();

	if(disorderType == "OMIM"){
		return webservice.getOmimLookupPath();
	}else if(disorderType == "ICD10"){
		return webservice.getIcd10LookupPath();
	}else if(disorderType == "SnomedCT"){
		return webservice.getSnomedCTLookupPath();
	}else if(disorderType == "GEL"){
		return webservice.getGELLookupPath();
	}else{
		return webservice.getOmimLookupPath();
	}
};
