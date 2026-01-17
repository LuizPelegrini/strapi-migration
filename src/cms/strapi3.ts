import config from '@/config/index.ts';
import type {
	Article,
	Belt,
	Category,
	Event,
	File,
	Guest,
	PrimaryCategory,
	Profile,
	Salutation,
	Show,
	ShowCategory,
	Socmed,
	Tag,
	User,
} from '@/types.ts';
import axios from 'axios';

const client = axios.create({
	baseURL: config.strapi3.baseUrl,
	params: {
		token: config.strapi3.token,
	},
});

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getArticles = async () => {
	const { data } = await client.get<Article[]>('/articles');
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getPrimaryCategories = async () => {
	const { data } = await client.get<PrimaryCategory[]>(
		'/primary-categories/migration',
	);
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getCategories = async () => {
	const { data } = await client.get<Category[]>('/categories/migration');
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShowCategories = async () => {
	const { data } = await client.get<ShowCategory[]>('/show-categories');
	return data;
};

const getShowCategoryByShowSubCategoryId = async (
	showSubCategoryId: number,
) => {
	const { data } = await client.get<ShowCategory[]>('/show-categories', {
		params: {
			_where: {
				'subcategories.id': showSubCategoryId,
			},
		},
	});

	// we might not find a show category for a given show subcategory
	return data[0] ? data[0] : null;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShowSubCategories = async () => {
	const { data } = await client.get<ShowCategory[]>('/show-subcategories');
	return data;
};

const getFiles = async () => {
	const { data } = await client.get<File[]>('/upload/files', {
		params: {
			_start: 0,
			// https://arc.net/l/quote/owqtkofw
			// Getting all files, we can paginate if needed, but I'm too lazy to do it now
			_limit: -1,
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShows = async () => {
	const { data } = await client.get<Show[]>('/shows/migration', {
		params: {
			_start: 0,
			// https://arc.net/l/quote/owqtkofw
			// Getting all files, we can paginate if needed, but I'm too lazy to do it now
			_limit: -1,
			_publicationState: 'preview',
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getUsers = async () => {
	const { data } = await client.get<User[]>('/users/migration', {
		params: {
			_start: 0,
			_limit: -1,
		},
	});

	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getBelts = async () => {
	const { data } = await client.get<Belt[]>('/belts', {
		params: {
			_start: 0,
			_limit: -1,
			_publicationState: 'preview',
		},
	});

	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getSalutations = async () => {
	const { data } = await client.get<Salutation[]>('/salutations/migration', {
		params: {
			_start: 0,
			_limit: -1,
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getProfiles = async () => {
	const { data } = await client.get<Profile[]>('/profiles/original', {
		params: {
			_start: 0,
			_limit: -1,
			_publicationState: 'preview', // getting all profiles
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getSocmeds = async () => {
	const { data } = await client.get<Socmed[]>('/socmeds', {
		params: {
			_start: 0,
			_limit: -1,
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getTags = async () => {
	const { data } = await client.get<Tag[]>('/tags/original', {
		params: {
			_start: 0,
			_limit: -1,
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getGuests = async () => {
	const { data } = await client.get<Guest[]>('/guests', {
		params: {
			_start: 0,
			_limit: -1,
			_publicationState: 'preview', // getting all guests
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getEvents = async () => {
	const { data } = await client.get<Event[]>('/events/original', {
		params: {
			_start: 0,
			_limit: -1,
			_publicationState: 'preview', // getting all events
		},
	});
	return data;
};

export default {
	getArticles,
	getPrimaryCategories,
	getCategories,
	getShowCategories,
	getShowCategoryByShowSubCategoryId,
	getShowSubCategories,
	getFiles,
	getShows,
	getUsers,
	getBelts,
	getSalutations,
	getProfiles,
	getSocmeds,
	getTags,
	getGuests,
	getEvents,
};
