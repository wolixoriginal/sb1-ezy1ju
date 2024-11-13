import express from 'express';
import { Actor } from '../models/actor.js';

export const UIRouter = express.Router();

UIRouter.get('/', (req, res) => {
  const actors = Array.from(Actor.actors.values());
  const error = req.query.error;
  res.render('home', { actors, error });
});

UIRouter.get('/profile/:username', (req, res) => {
  const actor = Actor.findByUsername(req.params.username);
  if (!actor) {
    return res.redirect('/?error=User not found');
  }
  
  const currentActor = req.query.currentUser ? Actor.findByUsername(req.query.currentUser) : null;
  const isFollowing = currentActor ? currentActor.following.has(actor.id) : false;
  
  res.render('profile', { 
    actor, 
    currentActor,
    isFollowing,
    error: req.query.error 
  });
});

UIRouter.post('/create-account', (req, res) => {
  const { username, displayName } = req.body;
  
  if (!username || username.length < 3) {
    return res.redirect('/?error=Username must be at least 3 characters');
  }

  try {
    const actor = Actor.create(username);
    if (displayName) {
      actor.displayName = displayName;
    }
    res.redirect(`/profile/${username}?currentUser=${username}`);
  } catch (error) {
    res.redirect(`/?error=${error.message}`);
  }
});

UIRouter.post('/post/:username', (req, res) => {
  const { content } = req.body;
  const actor = Actor.findByUsername(req.params.username);
  
  if (!actor) {
    return res.redirect('/?error=User not found');
  }

  if (!content || content.trim().length === 0) {
    return res.redirect(`/profile/${actor.username}?error=Post content cannot be empty&currentUser=${actor.username}`);
  }

  actor.createPost(content.trim());
  res.redirect(`/profile/${actor.username}?currentUser=${actor.username}`);
});

UIRouter.post('/follow/:username', (req, res) => {
  const { currentUser } = req.body;
  const targetActor = Actor.findByUsername(req.params.username);
  const follower = Actor.findByUsername(currentUser);

  if (!targetActor || !follower) {
    return res.redirect('/?error=User not found');
  }

  follower.follow(targetActor);
  res.redirect(`/profile/${targetActor.username}?currentUser=${follower.username}`);
});

UIRouter.post('/unfollow/:username', (req, res) => {
  const { currentUser } = req.body;
  const targetActor = Actor.findByUsername(req.params.username);
  const follower = Actor.findByUsername(currentUser);

  if (!targetActor || !follower) {
    return res.redirect('/?error=User not found');
  }

  follower.unfollow(targetActor);
  res.redirect(`/profile/${targetActor.username}?currentUser=${follower.username}`);
});