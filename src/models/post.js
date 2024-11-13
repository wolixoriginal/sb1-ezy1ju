import crypto from 'crypto';

export class Post {
  constructor(content, actor) {
    this.id = `http://localhost:3000/posts/${crypto.randomUUID()}`;
    this.type = 'Note';
    this.content = content;
    this.attributedTo = actor.id;
    this.published = new Date().toISOString();
    this.likes = new Set();
    this.replies = [];
  }

  toActivityPub() {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: this.id,
      type: this.type,
      content: this.content,
      attributedTo: this.attributedTo,
      published: this.published,
      likes: Array.from(this.likes),
      replies: this.replies
    };
  }
}