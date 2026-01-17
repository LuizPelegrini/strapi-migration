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

export type Video = {
	title: string;
	slug: string;
	description: string | null;
	hide_download: boolean;
	hide_sponsor: boolean;
	editors_picked: boolean;
	producers: Relation;
	presenters: Relation;
	guests: Relation;
	categories: Relation;
	show: Relation;
	tags: Relation;
	is_hero: boolean;
	publish_at: string | null;
	video: Json | null;
	socmeds: Relation;
	image_1x1: Json | null;
	image_16x9: Json | null;
	image_9x16: Json | null;
	user_created_by: Relation | null;
	user_updated_by: Relation | null;
	is_delisted: boolean;
	uuid: string;
	duration: number;
};
