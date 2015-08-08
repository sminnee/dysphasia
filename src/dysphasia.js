var Parser = require('./parser/parser');

function DysphasiaFile (input) {
	this.input = input;
}

DysphasiaFile.prototype.parseTree = function () {
	return Parser.parse(this.input);
}

module.exports = {
	loadString: function(string) {
		return new DysphasiaFile(string);
	}
}