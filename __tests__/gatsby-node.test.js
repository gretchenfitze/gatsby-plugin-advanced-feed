let fs;
let feed;
let onPostBuild;

jest.mock('fs');

const siteMetadata = {
  author: 'Foo Bar',
  description: 'My description',
  email: 'foo@example.com',
  siteUrl: 'https://example.com',
  title: 'My Feed',
};

const edges = [
  {
    node: {
      frontmatter: { title: 'Article 1', date: '2019-09-01T06:00:00.000Z' },
      fields: { slug: '/article1' },
      html: 'content 1',
    },
  },
];

beforeEach(() => {
  jest.resetModules().resetAllMocks();

  fs = require('fs');
  feed = require('feed');
  onPostBuild = require('../src/gatsby-node').onPostBuild;
});

describe('onPostBuild()', () => {
  const graphql = jest.fn();

  it('should throw error if `feeds` option is not an array', async () => {
    expect.assertions(1);

    try {
      await onPostBuild({ graphql }, { feeds: 'invalid' });
    } catch (err) {
      expect(err.message).toContain('must be an array');
    }
  });

  it('should throw the errors returned from graphql', async () => {
    expect.assertions(1);

    graphql.mockImplementation(() => ({
      errors: { message: 'graphql error' },
    }));

    try {
      await onPostBuild({ graphql }, {});
    } catch (err) {
      expect(err.message).toContain('graphql error');
    }
  });

  describe('with default or valid options', () => {
    let feedMock;
    let addContributorMock;
    let addItemMock;

    beforeEach(() => {
      addContributorMock = jest.fn();
      addItemMock = jest.fn();
      feedMock = jest.spyOn(feed, 'Feed');

      graphql.mockImplementation(() => ({
        data: { allMarkdownRemark: { edges }, site: { siteMetadata } },
      }));
    });

    it('should initiate `Feed` with default options', async () => {
      await onPostBuild({ graphql }, {});

      expect(feedMock).toHaveBeenCalledTimes(1);
      expect(feedMock.mock.calls[0][0].title).toBe(siteMetadata.title);
      expect(feedMock.mock.calls[0][0].link).toBe(siteMetadata.siteUrl);
      expect(feedMock.mock.calls[0][0].id).toBe(siteMetadata.siteUrl);
      expect(feedMock.mock.calls[0][0].description).toBe(
        siteMetadata.description
      );
      const copyright = `All rights reserved ${new Date().getUTCFullYear()}, ${
        siteMetadata.author
      }`;
      expect(feedMock.mock.calls[0][0].copyright).toBe(copyright);
      expect(feedMock.mock.calls[0][0].feedLinks.atom).toBe(
        `${siteMetadata.siteUrl}/atom.xml`
      );
      expect(feedMock.mock.calls[0][0].feedLinks.rss2).toBe(
        `${siteMetadata.siteUrl}/rss.xml`
      );
      expect(feedMock.mock.calls[0][0].feedLinks.json).toBe(
        `${siteMetadata.siteUrl}/feed.json`
      );
      expect(feedMock.mock.calls[0][0].author.name).toBe(siteMetadata.author);
      expect(feedMock.mock.calls[0][0].author.email).toBe(siteMetadata.email);
      expect(feedMock.mock.calls[0][0].author.link).toBe(siteMetadata.siteUrl);
    });

    it('should initiate `Feed` with valid options', async () => {
      const options = {
        title: 'Custom title',
        link: 'https://example.org',
        author: 'Custom author',
        copyright: 'Custom copyright',
        description: 'Custom description',
        id: 'custom id',
      };
      await onPostBuild({ graphql }, { feeds: [options] });

      expect(feedMock).toHaveBeenCalledTimes(1);
      expect(feedMock.mock.calls[0][0].title).toBe(options.title);
      expect(feedMock.mock.calls[0][0].link).toBe(options.link);
      expect(feedMock.mock.calls[0][0].id).toBe(options.id);
      expect(feedMock.mock.calls[0][0].description).toBe(options.description);
      expect(feedMock.mock.calls[0][0].copyright).toBe(options.copyright);
      expect(feedMock.mock.calls[0][0].author.name).toBe(options.author);
      expect(feedMock.mock.calls[0][0].author.email).toBe(siteMetadata.email);
      expect(feedMock.mock.calls[0][0].author.link).toBe(siteMetadata.siteUrl);
    });

    it('should add items to feed', async () => {
      feedMock.mockImplementation(() => ({
        addContributor: addContributorMock,
        addItem: addItemMock,
        atom1: jest.fn(),
        rss2: jest.fn(),
        json1: jest.fn(),
      }));

      await onPostBuild({ graphql }, {});

      expect(addItemMock).toHaveBeenCalledTimes(1);
      expect(addItemMock.mock.calls[0][0].title).toBe(
        edges[0].node.frontmatter.title
      );
      expect(addItemMock.mock.calls[0][0].id).toBe(
        `${siteMetadata.siteUrl}${edges[0].node.fields.slug}`
      );
      expect(addItemMock.mock.calls[0][0].link).toBe(
        `${siteMetadata.siteUrl}${edges[0].node.fields.slug}`
      );
      expect(addItemMock.mock.calls[0][0].date).toEqual(
        new Date(edges[0].node.frontmatter.date)
      );
      expect(addItemMock.mock.calls[0][0].content).toBe(edges[0].node.html);
      expect(addItemMock.mock.calls[0][0].author[0].name).toBe(
        siteMetadata.author
      );
      expect(addItemMock.mock.calls[0][0].author[0].email).toBe(
        siteMetadata.email
      );
      expect(addItemMock.mock.calls[0][0].author[0].link).toBe(
        siteMetadata.siteUrl
      );
    });

    it('should not render email address if `false`', async () => {
      feedMock.mockImplementation(() => ({
        addContributor: addContributorMock,
        addItem: addItemMock,
        atom1: jest.fn(),
        rss2: jest.fn(),
        json1: jest.fn(),
      }));
      graphql.mockImplementation(() => ({
        data: {
          allMarkdownRemark: { edges },
          site: { siteMetadata: { ...siteMetadata, email: false } },
        },
      }));

      await onPostBuild({ graphql }, {});

      expect(feedMock.mock.calls[0][0].author.email).toBeUndefined();
      expect(addItemMock.mock.calls[0][0].author[0].email).toBeUndefined();
    });

    it('should generate Atom feed', async () => {
      await onPostBuild({ graphql }, {});

      const atom = fs.readFileSync('./public/atom.xml');
      expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    });

    it('should generate RSS2 feed', async () => {
      await onPostBuild({ graphql }, {});

      const rss = fs.readFileSync('./public/rss.xml');
      expect(rss).toContain('<rss version="2.0"');
    });

    it('should genreate JSON feed', async () => {
      await onPostBuild({ graphql }, {});

      const json = fs.readFileSync('./public/feed.json');
      expect(json).toContain('"version": "https://jsonfeed.org/version/1"');
    });
  });
});