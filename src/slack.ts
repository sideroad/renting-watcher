import axios from 'axios';
import { Property } from './types';
import { getSlackWebhookUrl } from './config';

export class SlackNotifier {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = getSlackWebhookUrl();
    if (!this.webhookUrl) {
      console.warn('Slack webhook URL is not configured');
    }
  }

  async notifyNewProperties(properties: Property[]): Promise<void> {
    if (!this.webhookUrl || properties.length === 0) {
      return;
    }

    const blocks = this.createBlocks(properties);
    
    try {
      await axios.post(this.webhookUrl, {
        blocks,
        text: `新着物件が${properties.length}件見つかりました！`
      });
      console.log(`Sent notification for ${properties.length} new properties`);
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  private createBlocks(properties: Property[]): any[] {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🏠 新着物件: ${properties.length}件`,
          emoji: true
        }
      },
      {
        type: 'divider'
      }
    ];

    properties.slice(0, 10).forEach((property, index) => {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${property.title}*\n` +
                  `💰 ${property.price}\n` +
                  `📍 ${property.address}\n` +
                  `🏢 ${property.layout} / ${property.area}\n` +
                  `🚉 ${property.access.join(' / ')}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '詳細を見る',
              emoji: true
            },
            url: property.url,
            action_id: `view_property_${property.id}`
          }
        }
      );

      if (index < properties.length - 1 && index < 9) {
        blocks.push({
          type: 'divider'
        });
      }
    });

    if (properties.length > 10) {
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `他${properties.length - 10}件の新着物件があります`
            }
          ]
        }
      );
    }

    return blocks;
  }
}