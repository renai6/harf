let checked = false;

/** Whether the mic check passed in this page session; kept in memory, so a reload asks again (spec 6). */
export const micSession = {
	get checked() {
		return checked;
	},
	pass() {
		checked = true;
	}
};
