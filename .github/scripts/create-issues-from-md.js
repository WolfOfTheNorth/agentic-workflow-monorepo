const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const STORIES_FOLDER = process.argv[2] || '.github/stories';

async function createIssue(title, body) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`;
  try {
    const res = await axios.post(
      url,
      { title, body },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`Created: ${title}`);
  } catch (err) {
    console.error(`Error creating issue "${title}":`, err.response?.data || err.message);
  }
}

function parseStories(md) {
  const stories = [];
  const storyRegex = /## Story: (.+?)\n\n\*\*Description:\*\* (.+?)(?=\n## Story:|$)/gs;
  let match;
  while ((match = storyRegex.exec(md)) !== null) {
    stories.push({ title: match[1].trim(), body: match[2].trim() });
  }
  return stories;
}

async function main() {
  const files = fs.readdirSync(STORIES_FOLDER).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const md = fs.readFileSync(path.join(STORIES_FOLDER, file), 'utf8');
    const stories = parseStories(md);
    for (const story of stories) {
      await createIssue(story.title, story.body);
    }
  }
}

main();
