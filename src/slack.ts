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

    try {
      // Sort properties by area (high to low) then by price (low to high)
      const sortedProperties = this.sortPropertiesForNotification(properties);
      
      // Send header message
      await this.sendHeaderMessage(sortedProperties);
      
      // Split properties into chunks and send each chunk
      const chunks = this.splitPropertiesIntoChunks(sortedProperties);
      
      for (let i = 0; i < chunks.length; i++) {
        await this.sendPropertyChunk(chunks[i], i + 1, chunks.length);
        // Small delay between messages to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Send summary message
      await this.sendSummaryMessage(sortedProperties);
      
      console.log(`Sent notification for ${properties.length} new properties in ${chunks.length + 2} messages`);
      
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      
      // Fallback: send simple text message
      try {
        await this.sendFallbackNotification(properties);
      } catch (fallbackError) {
        console.error('Fallback notification also failed:', fallbackError);
      }
    }
  }

  private sortPropertiesForNotification(properties: Property[]): Property[] {
    return [...properties].sort((a, b) => {
      // Extract area numbers for comparison
      const areaA = this.extractAreaNumber(a.area);
      const areaB = this.extractAreaNumber(b.area);
      
      // Extract price numbers for comparison
      const priceA = this.extractPriceNumber(a.price);
      const priceB = this.extractPriceNumber(b.price);
      
      // First sort key: Area (high to low)
      if (areaA !== areaB) {
        return areaB - areaA; // Descending order (high to low)
      }
      
      // Second sort key: Price (low to high)
      return priceA - priceB; // Ascending order (low to high)
    });
  }

  private extractAreaNumber(areaString: string): number {
    // Extract number from strings like "65.81㎡", "72.0㎡", "74.52m2", etc.
    const match = areaString.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractPriceNumber(priceString: string): number {
    // Extract number from strings like "25.7万円", "13万円", etc.
    const match = priceString.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private async sendHeaderMessage(properties: Property[]): Promise<void> {
    const grouped = this.groupPropertiesByPrice(properties);
    const summary = Object.entries(grouped)
      .map(([range, props]) => `${range}: ${props.length}件`)
      .join(' | ');

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!channel> 🏠 *新着物件: ${properties.length}件発見！*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *価格帯別サマリー*\n${summary}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '📋 以下、全物件の詳細情報をお送りします...'
          }
        ]
      }
    ];

    await axios.post(this.webhookUrl, { blocks });
  }

  private splitPropertiesIntoChunks(properties: Property[]): Property[][] {
    // Calculate approximate message size and split accordingly
    // Target: ~4-5 properties per message to stay under size limits
    const chunks: Property[][] = [];
    const chunkSize = 5;
    
    for (let i = 0; i < properties.length; i += chunkSize) {
      chunks.push(properties.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  private async sendPropertyChunk(properties: Property[], chunkNum: number, totalChunks: number): Promise<void> {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📄 *物件詳細 (${chunkNum}/${totalChunks})*`
        }
      },
      {
        type: 'divider'
      }
    ];

    properties.forEach((property, index) => {
      const globalIndex = (chunkNum - 1) * 5 + index + 1;
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${globalIndex}. ${property.title}*
` +
                `💰 *賃料:* ${property.price}
` +
                `📍 *住所:* ${property.address}
` +
                `🏠 *間取り:* ${property.layout} / ${property.area}
` +
                `🚉 *アクセス:* ${property.access.slice(0, 2).join(' / ')}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '詳細を見る',
            emoji: true
          },
          url: property.url,
          action_id: `view_property_${property.id.substring(0, 8)}`
        }
      } as any);

      // Add divider between properties (except for the last one)
      if (index < properties.length - 1) {
        blocks.push({
          type: 'divider'
        });
      }
    });

    await axios.post(this.webhookUrl, { blocks });
  }

  private async sendSummaryMessage(properties: Property[]): Promise<void> {
    const areas = this.getUniqueAreas(properties);
    const priceRange = this.getPriceRange(properties);
    
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *全${properties.length}件の物件情報送信完了*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*価格帯:*\n${priceRange}`
          },
          {
            type: 'mrkdwn',
            text: `*主要エリア:*\n${areas.slice(0, 5).map(area => `• ${area}`).join('\n')}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🎯 気になる物件があればボタンから詳細をご確認ください！'
          }
        ]
      }
    ];

    await axios.post(this.webhookUrl, { blocks });
  }

  private async sendFallbackNotification(properties: Property[]): Promise<void> {
    const message = `@channel 🏠 新着物件: ${properties.length}件\n` +
                   `価格帯: ${this.getPriceRange(properties)}\n` +
                   `主要エリア: ${this.getUniqueAreas(properties).slice(0, 3).join(', ')}\n\n` +
                   `詳細情報の送信でエラーが発生しました。`;

    await axios.post(this.webhookUrl, {
      text: message
    });
    
    console.log('Sent fallback notification');
  }


  private groupPropertiesByPrice(properties: Property[]): { [key: string]: Property[] } {
    const groups: { [key: string]: Property[] } = {
      '10万円未満': [],
      '10-15万円': [],
      '15-20万円': [],
      '20-25万円': [],
      '25万円以上': []
    };

    properties.forEach(property => {
      const priceNum = parseFloat(property.price.replace(/[万円]/g, ''));
      
      if (priceNum < 10) {
        groups['10万円未満'].push(property);
      } else if (priceNum < 15) {
        groups['10-15万円'].push(property);
      } else if (priceNum < 20) {
        groups['15-20万円'].push(property);
      } else if (priceNum < 25) {
        groups['20-25万円'].push(property);
      } else {
        groups['25万円以上'].push(property);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }

  private getPriceRange(properties: Property[]): string {
    const prices = properties.map(p => parseFloat(p.price.replace(/[万円]/g, '')));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `${min}万円 - ${max}万円`;
  }

  private getUniqueAreas(properties: Property[]): string[] {
    const areas = new Set<string>();
    properties.forEach(property => {
      const area = property.address.split(/[区市]/)[0];
      if (area) {
        areas.add(area + (property.address.includes('区') ? '区' : '市'));
      }
    });
    return Array.from(areas);
  }
}