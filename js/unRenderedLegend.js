/**
 * Class responsible for keeping track of HPO terms and their properties, and for
 * caching disorders data as loaded from the OMIM database.
 * This information is graphically displayed in a 'Legend' box
 *
 * @class HPOLegend
 * @constructor
 */
var unRenderedLegend = Class.create(unRenderedLegendSuper, {

	initialize: function ($super) {
		$super("Unassigned participants", true);
		this._termCache = {};
	},

	_getPrefix: function (id) {
		return "UnRendered";
	},

	/**
	 * Retrieve the color associated with the given object
	 *
	 * @method getObjectColor
	 * @param {String|Number} id ID of the object
	 * @return {String} CSS color value for that disorder
	 */
	getObjectColor: function (id) {
		return "#CCCCCC";
	},

	/**
	 * Registers an occurrence of a phenotype.
	 *
	 * @method addCase
	 * @param {Number|String} id ID for this term taken from the HPO database
	 * @param {String} name The description of the phenotype
	 * @param {Number} nodeID ID of the Person who has this phenotype
	 */
	addCase: function ($super, id, name, nodeID) {
		if (!this._termCache.hasOwnProperty(id))
			this._termCache[id] = new HPOTerm(id, name);

		$super(id, name, nodeID);
	},

	addNode: function ($super, id, name, nodeID, node) {
		if (!this._termCache.hasOwnProperty(id))
			this._termCache[id] = { id:id, name:name};//new HPOTerm(id, name);

		$super(id, name, nodeID, node);
	},

	/**
	 * Updates the displayed phenotype name for the given phenotype
	 *
	 * @method _updateTermName
	 * @param {Number} id The identifier of the phenotype to update
	 * @private
	 */
	_updateTermName: function (id) {
		//console.log("updating phenotype display for " + id + ", name = " + this.getTerm(id).getName());
		var _this = this;
		var name = this._legendBox.down('li#' + this._getPrefix() + '-' + _this._hashID(id) + ' .disorder-name');
		name.update(this.getTerm(id).getName());
	},

	/**
	 * Callback for dragging an object from the legend onto nodes
	 *
	 * @method _onDropGeneric
	 * @param {Person} Person node
	 * @param {String|Number} id ID of the phenotype being dropped
	 */
	_onDropObject: function (node, hpoID, valueAll) {
		var self = this;

		if (node.isPersonGroup()) {
			return;
		}

		//if destination node has ParticipantId, we can NOT drop an unRendered node into it! so show a proper error message
		var participantId = node.getParticipantId();
		if(participantId && participantId.trim().length > 0){
			var closeFunction = function () {
				this.dialog.show();
			};
			editor.getOkCancelDialogue().showCustomized('You can not assign to a node that has Participant Id.',
				"Genomics England",
				"Close", closeFunction,
				null, null,
				null, null, true);
			return;
		}

		//the YesFunction when the user confirms that the copy should be done
		var yesFunction = function(){
			//copy all unRendered node values (valueAll) into the destination node (node)
			Person.copyUnassignedNode(node, valueAll);

			//successfully assigned the value into the destination node, so now change the color of the un-Rendered node in the list
			//now change its color to a gray
			var HTMLId = self._getPrefix() + valueAll.unRenderedIndex;
			var unRenderedNode = editor._unRenderedLegend._legendBox.select("#" + HTMLId);
			if(unRenderedNode.length > 0){
				unRenderedNode = unRenderedNode[0];
			}
			if(unRenderedNode) {
				unRenderedNode.removeClassName('UnRendered-legend-box-item');
				unRenderedNode.addClassName('UnRendered-legend-box-item-selected');
			}
		};
		//get confirmation
		editor.getOkCancelDialogue().showCustomized('Are you sure you want to assign the values to this node?',
			"Genomics England",
			"Yes", yesFunction,
			"No", closeFunction,
			null, true);
	}

});
