import Strapi3 from './cms/index.ts';

const articles = await Strapi3.getArticles();

console.log('Articles length:', articles.length);
