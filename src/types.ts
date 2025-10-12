// All Strapi 3 types
export type ApiToken = {
	id: number;
	token: string;
	user: User | null;
};

export type Article = {
	id: number;
	title: string;
	publish_on: string;
	slug: string;
	leadimage: string | null;
	og_image: string | null;
	content: string;
	unpublished_on: string | null;
	duration: number;
	excerpt: string | null;
	published_at: string;
	categories: Category[];
	owner: User | null;
	tags: Tag[];
	authors: Profile[];
	editors: Profile[];
	cloudsearch_id: string | null;
};

export type Belt = {
	id: number;
	name: string;
	slug: string | null;
	description: string | null;
	shows: Show[];
	live_status: boolean;
	updated_at: string;
	published_at: string | null;
};

export type Category = {
	id: number;
	name: string;
	description: string | null;
	// we want to migrate published and draft entries
	published_at: string | null;
	primary_category: number | null;
	updated_at: string;
};

export type Event = {
	id: number;
	Event_Name: string;
	Start_Date: string;
	End_Date: string | null;
	Description: string;
	Images: Json | null;
	slug: string;
	Excerpt: string | null;
	Show_In_Frontpage: boolean;
	Is_Hero: boolean;
	Event_Link: string | null;
	Brochure_Vanity_URL: string | null;
	eSharingKit_Link: string | null;
	eSharing_Vanity: string | null;
	Brochure_File_URL: string | null;
	publish_at: string;
	eSharingKits: Json | null;
	is_reminder: boolean;
	cloudsearch_id: string;
	owner: User | null;
	published_at: string;
	created_at: string;
	updated_at: string;
	Moderators: Profile[];
	Panelists: Guest[];
	categories: Category[];
	tags: Tag[];
};

export type Guest = {
	id: number;
	fullname: string;
	shortname: string | null;
	organisation: string | null;
	designation: string | null;
	salutations: Salutation[];
	user_created_by: User | null;
	user_updated_by: User | null;
	image: Json | null;
	description: string | null;
};

export type Podcast = {
	id: number;
	title: string;
	descriptor: string | null;
	leadimage: string | null;
	publish_at: string;
	onair_at: string;
	url_alias: string;
	podcast_duration: number;
	podcast_filesize: number;
	app_delist: boolean;
	hidesponsor: boolean;
	hidedownload: boolean;
	carousel_list: boolean;
	omny_id: string | null;
	omny_embed: string | null;
	omny_audio: string | null;
	omny_image: string | null;
	facebook_image: string | null;
	show: Show | null;
	original_mp3: string | null;
	owner: User | null;
	presenters: Profile[];
	producers: Profile[];
	tags: Tag[];
	categories: Category[];
	guests: Guest[];
	adbreaks: string;
	image_json: Json | null;
};

export type PrimaryCategory = {
	id: number;
	name: string;
	description: string | null;
	published_at: string | null;
	updated_at: string;
};

export type Profile = {
	id: number;
	name: string;
	presenter: boolean;
	producer: boolean;
	author: boolean;
	editor: boolean;
	moderator: boolean;
	image: Json | null;
	description: string | null;
	published_at: string | null;
	updated_at: string;
};

export type Salutation = {
	id: number;
	name: string;
	updated_at: string;
};

export type Show = {
	id: number;
	name: string;
	slug: string;
	description: string | null;
	status: boolean;
	audio_s3path: string;
	image_s3path: string;
	show_art: File | null;
	omny_programid: string | null;
	omny_playlistid: string | null;
	categories: ShowCategory[];
	subcategories: ShowCategory[];
	published_at: string | null;
	updated_at: string;
};

export type ShowCategory = {
	id: number;
	name: string;
	subcategories: ShowSubCategory[];
	updated_at: string;
};

export type ShowSubCategory = {
	id: number;
	name: string;
	updated_at: string;
};

export type Socmed = {
	id: number;
	url: string;
	source: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'other';
	other_source: string | null;
	updated_at: string;
};

export type Tag = {
	id: number;
	name: string;
	user_created_by: User | null;
	user_updated_by: User | null;
};

export type Video = {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	hide_download: boolean;
	hide_sponsor: boolean;
	editors_picked: boolean;
	producers: Profile[];
	presenters: Profile[];
	guests: Guest[];
	categories: Category[];
	tags: Tag[];
	is_hero: boolean;
	publish_at: string | null;
	video: File | null;
	socmeds: Socmed[];
	image_1x1: File | null;
	image_16x9: File | null;
	image_9x16: File | null;
	user_created_by: User | null;
	user_updated_by: User | null;
	is_delisted: boolean;
	uuid: string;
	duration: number;
	show: Show | null;
};

type Json = {
	[key: string]: string | number | boolean | Json;
};

export type User = {
	id: number;
	username: string;
	email: string;
	confirmed: boolean;
	blocked: boolean;
	updated_at: string;
	avatar: File | null;
	password: string;
	role: {
		name: string;
		type: string;
	};
	shows: Show[];
};

export type File = {
	id: number;
	name: string;
	alternativeText: string;
	caption: string;
	width: number;
	height: number;
	formats: {
		thumbnail: Format;
		large: Format;
		large_webp: Format;
		medium: Format;
		medium_webp: Format;
		small: Format;
		small_webp: Format;
	};
	hash: string;
	ext: string;
	mime: string;
	size: number;
	url: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	previewUrl: any;
	provider: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	provider_metadata: any;
	created_at: string;
	updated_at: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	related?: any[];
};

type Format = {
	name: string;
	hash: string;
	ext: string;
	mime: string;
	width: number;
	height: number;
	size: number;
	path: string;
	url: string;
};
