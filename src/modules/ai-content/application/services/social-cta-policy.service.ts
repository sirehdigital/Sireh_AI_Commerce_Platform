import type { SocialMediaContentGenerationOptions } from "../dto/social-media-content.types.js";

export class SocialCTAPolicyService {
  public build(options: SocialMediaContentGenerationOptions): readonly string[] {
    const english: Record<SocialMediaContentGenerationOptions["objective"], readonly string[]> = {
      awareness: ["Discover the details"],
      engagement: ["Tell us what you think"],
      traffic: ["Visit the product page"],
      conversion: ["Shop now"],
      education: ["Learn more"],
      "product-launch": ["Explore the collection"],
      retargeting: ["Take another look"],
      "community-building": ["Join the conversation"],
      "lead-generation": ["Learn more"],
      "brand-positioning": ["Explore the brand story"],
    };
    const malay: Record<SocialMediaContentGenerationOptions["objective"], readonly string[]> = {
      awareness: ["Ketahui butiran lanjut"],
      engagement: ["Kongsi pandangan anda"],
      traffic: ["Lawati halaman produk"],
      conversion: ["Beli sekarang"],
      education: ["Ketahui lebih lanjut"],
      "product-launch": ["Terokai koleksi"],
      retargeting: ["Lihat semula pilihan ini"],
      "community-building": ["Sertai perbualan"],
      "lead-generation": ["Ketahui lebih lanjut"],
      "brand-positioning": ["Terokai kisah jenama"],
    };

    const pool = options.language === "ms" ? malay[options.objective] : english[options.objective];
    return pool.slice(0, options.ctaCount);
  }
}
