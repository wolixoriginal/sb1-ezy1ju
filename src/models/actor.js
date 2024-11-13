import crypto from 'crypto';
import { Post } from './post.js';

export class Actor {
  constructor(username) {
    this.username = username;
    this.id = `http://localhost:3000/users/${username}`;
    this.followers = new Set();
    this.following = new Set();
    this.inbox = [];
    this.outbox = [];
    this.displayName = username;
    this.summary = '';
    this.avatar = `https://avatars.dicebear.com/api/initials/${username}.svg`;
    const keys = this.generateKeyPair();
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
  }

  static actors = new Map();

  static create(username) {
    if (this.actors.has(username)) {
      throw new Error('Username already taken');
    }
    const actor = new Actor(username);
    this.actors.set(username, actor);
    return actor;
  }

  static findByUsername(username) {
    return this.actors.get(username);
  }

  generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  createPost(content) {
    const post = new Post(content, this);
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      actor: this.id,
      object: post.toActivityPub(),
      published: new Date().toISOString()
    };
    this.outbox.unshift(activity);
    return post;
  }

  follow(targetActor) {
    if (targetActor.id === this.id) return false;
    if (this.following.has(targetActor.id)) return false;
    
    this.following.add(targetActor.id);
    targetActor.followers.add(this.id);
    return true;
  }

  unfollow(targetActor) {
    this.following.delete(targetActor.id);
    targetActor.followers.delete(this.id);
  }

  toActivityPub() {
    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      id: this.id,
      type: 'Person',
      preferredUsername: this.username,
      displayName: this.displayName,
      summary: this.summary,
      icon: {
        type: 'Image',
        url: this.avatar
      },
      inbox: `${this.id}/inbox`,
      outbox: `${this.id}/outbox`,
      followers: `${this.id}/followers`,
      following: `${this.id}/following`,
      publicKey: {
        id: `${this.id}#main-key`,
        owner: this.id,
        publicKeyPem: this.publicKey
      }
    };
  }
}