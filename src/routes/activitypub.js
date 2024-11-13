import express from 'express';
import { Actor } from '../models/actor.js';
import { SignatureHandler } from '../lib/signature.js';
import { DeliveryHandler } from '../lib/delivery.js';
import cacheManager from 'cache-manager';

export const ActivityPubRouter = express.Router();
const cache = cacheManager.caching({ store: 'memory', max: 1000, ttl: 3600 });

// Middleware to verify ActivityPub requests
const verifyActivityPubRequest = async (req, res, next) => {
  if (req.method === 'POST') {
    const isValid = await SignatureHandler.verifySignature(req);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  next();
};

// Get actor profile
ActivityPubRouter.get('/users/:username', async (req, res) => {
  const cacheKey = `actor:${req.params.username}`;
  const cachedActor = await cache.get(cacheKey);
  
  if (cachedActor) {
    return res.json(cachedActor);
  }

  const actor = Actor.findByUsername(req.params.username);
  if (!actor) {
    return res.status(404).json({ error: 'Actor not found' });
  }

  const activityPubActor = actor.toActivityPub();
  await cache.set(cacheKey, activityPubActor);
  res.json(activityPubActor);
});

// Handle incoming activities to an actor's inbox
ActivityPubRouter.post('/users/:username/inbox', verifyActivityPubRequest, async (req, res) => {
  const actor = Actor.findByUsername(req.params.username);
  if (!actor) {
    return res.status(404).json({ error: 'Actor not found' });
  }

  const activity = req.body;
  
  try {
    switch (activity.type) {
      case 'Follow':
        await handleFollow(actor, activity);
        break;
        
      case 'Undo':
        if (activity.object.type === 'Follow') {
          await handleUnfollow(actor, activity);
        }
        break;
        
      case 'Create':
        await handleCreate(actor, activity);
        break;
        
      case 'Like':
        await handleLike(actor, activity);
        break;
        
      case 'Announce':
        await handleAnnounce(actor, activity);
        break;
        
      default:
        return res.status(400).json({ error: 'Unsupported activity type' });
    }

    res.status(202).send();
  } catch (error) {
    console.error('Error processing activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleFollow(actor, activity) {
  actor.followers.add(activity.actor);
  
  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Accept',
    actor: actor.id,
    object: activity
  };

  const sender = await fetchActor(activity.actor);
  await DeliveryHandler.deliverToInbox(accept, sender, actor);
}

async function handleUnfollow(actor, activity) {
  actor.followers.delete(activity.actor);
}

async function handleCreate(actor, activity) {
  actor.inbox.push(activity);
  // Process mentions and notify mentioned users
  const mentions = extractMentions(activity.object.content);
  for (const mention of mentions) {
    const mentionedActor = Actor.findByUsername(mention);
    if (mentionedActor) {
      await DeliveryHandler.deliverToInbox(activity, mentionedActor, actor);
    }
  }
}

async function handleLike(actor, activity) {
  const post = findPost(activity.object);
  if (post) {
    post.likes.add(activity.actor);
  }
}

async function handleAnnounce(actor, activity) {
  const post = findPost(activity.object);
  if (post) {
    post.shares = (post.shares || 0) + 1;
    // Deliver to followers
    for (const followerId of actor.followers) {
      const follower = await fetchActor(followerId);
      await DeliveryHandler.deliverToInbox(activity, follower, actor);
    }
  }
}

function extractMentions(content) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = content.match(mentionRegex) || [];
  return matches.map(match => match.substring(1));
}

async function fetchActor(actorId) {
  const cacheKey = `remote_actor:${actorId}`;
  const cachedActor = await cache.get(cacheKey);
  
  if (cachedActor) {
    return cachedActor;
  }

  const response = await fetch(actorId);
  const actor = await response.json();
  await cache.set(cacheKey, actor);
  return actor;
}

function findPost(postId) {
  // Implementation to find a post across all actors
  // This would need to be implemented based on your storage solution
  return null;
}

// Get actor's outbox
ActivityPubRouter.get('/users/:username/outbox', async (req, res) => {
  const actor = Actor.findByUsername(req.params.username);
  if (!actor) {
    return res.status(404).json({ error: 'Actor not found' });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const start = (page - 1) * limit;
  const items = actor.outbox.slice(start, start + limit);

  res.json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'OrderedCollectionPage',
    totalItems: actor.outbox.length,
    orderedItems: items,
    next: items.length === limit ? 
      `${actor.id}/outbox?page=${page + 1}` : undefined,
    prev: page > 1 ? 
      `${actor.id}/outbox?page=${page - 1}` : undefined
  });
});

// Create and send new activities
ActivityPubRouter.post('/users/:username/outbox', async (req, res) => {
  const actor = Actor.findByUsername(req.params.username);
  if (!actor) {
    return res.status(404).json({ error: 'Actor not found' });
  }

  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    actor: actor.id,
    object: {
      ...req.body,
      id: `${actor.id}/posts/${crypto.randomUUID()}`,
      attributedTo: actor.id,
      published: new Date().toISOString()
    },
    published: new Date().toISOString()
  };

  actor.outbox.unshift(activity);

  // Deliver to followers
  for (const followerId of actor.followers) {
    try {
      const follower = await fetchActor(followerId);
      await DeliveryHandler.deliverToInbox(activity, follower, actor);
    } catch (error) {
      console.error(`Failed to deliver to ${followerId}:`, error);
    }
  }

  res.status(201).json(activity);
});