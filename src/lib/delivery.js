import Queue from 'queue';
import { SignatureHandler } from './signature.js';

export class DeliveryHandler {
  static queue = new Queue({ concurrency: 5 });

  static async deliverToInbox(activity, recipient, sender) {
    const delivery = async () => {
      try {
        const response = await fetch(recipient.inbox, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/activity+json',
            'User-Agent': 'FederatedSocial/1.0',
            ...this.createSignatureHeaders(activity, sender)
          },
          body: JSON.stringify(activity)
        });

        if (!response.ok) {
          throw new Error(`Delivery failed: ${response.statusText}`);
        }

        console.log(`Successfully delivered to ${recipient.inbox}`);
      } catch (error) {
        console.error(`Failed to deliver to ${recipient.inbox}:`, error);
        throw error;
      }
    };

    return new Promise((resolve, reject) => {
      this.queue.push(() => delivery().then(resolve).catch(reject));
      if (!this.queue.running) {
        this.queue.start();
      }
    });
  }

  static createSignatureHeaders(activity, sender) {
    const date = new Date().toUTCString();
    const signature = SignatureHandler.signRequest(
      { body: JSON.stringify(activity) },
      sender.privateKey
    );

    return {
      Date: date,
      Signature: `keyId="${sender.id}#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="${signature.signature}"`
    };
  }
}