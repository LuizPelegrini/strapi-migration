type Json = {
	[key: string]: string | number | boolean | Json;
};

// relations are arrays of documentIds
// oneToMany = [documentId1, documentId2]
// oneToOne = [documentId1]
type Relation = string[];

export type Event = {
	Event_Name: string;
	Start_Date: string;
	End_Date: string | null;
	Description: string;
	Moderators: Relation;
	Panelists: Relation;
	Images: Json | null;
	categories: Relation;
	tags: Relation;
	slug: string;
	Excerpt: string | null;
	Show_In_Frontpage: boolean;
	Is_Hero: boolean;
	Event_Link: string | null;
	Brochure_Vanity_URL: string | null;
	eSharingKit_Link: string | null;
	eSharing_Vanity: string | null;
	Brochure_File_URL: string | null;
	locked_by: Relation | null;
	locked_until: string | null;
	publish_at: string;
	eSharingKits: Json | null;
	is_reminder: boolean;
	cloudsearch_id: string;
	owner: Relation | null;
};
