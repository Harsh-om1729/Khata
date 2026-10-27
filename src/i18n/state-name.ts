import type { StateCode } from '../profile';
import type { Lang } from './types';

const names: Record<StateCode, Record<Lang, string>> = {
  '01': { hi: 'जम्मू और कश्मीर', en: 'Jammu and Kashmir' },
  '02': { hi: 'हिमाचल प्रदेश', en: 'Himachal Pradesh' },
  '03': { hi: 'पंजाब', en: 'Punjab' },
  '04': { hi: 'चंडीगढ़', en: 'Chandigarh' },
  '05': { hi: 'उत्तराखंड', en: 'Uttarakhand' },
  '06': { hi: 'हरियाणा', en: 'Haryana' },
  '07': { hi: 'दिल्ली', en: 'Delhi' },
  '08': { hi: 'राजस्थान', en: 'Rajasthan' },
  '09': { hi: 'उत्तर प्रदेश', en: 'Uttar Pradesh' },
  '10': { hi: 'बिहार', en: 'Bihar' },
  '11': { hi: 'सिक्किम', en: 'Sikkim' },
  '12': { hi: 'अरुणाचल प्रदेश', en: 'Arunachal Pradesh' },
  '13': { hi: 'नागालैंड', en: 'Nagaland' },
  '14': { hi: 'मणिपुर', en: 'Manipur' },
  '15': { hi: 'मिज़ोरम', en: 'Mizoram' },
  '16': { hi: 'त्रिपुरा', en: 'Tripura' },
  '17': { hi: 'मेघालय', en: 'Meghalaya' },
  '18': { hi: 'असम', en: 'Assam' },
  '19': { hi: 'पश्चिम बंगाल', en: 'West Bengal' },
  '20': { hi: 'झारखंड', en: 'Jharkhand' },
  '21': { hi: 'ओडिशा', en: 'Odisha' },
  '22': { hi: 'छत्तीसगढ़', en: 'Chhattisgarh' },
  '23': { hi: 'मध्य प्रदेश', en: 'Madhya Pradesh' },
  '24': { hi: 'गुजरात', en: 'Gujarat' },
  '26': { hi: 'दादरा और नगर हवेली और दमन और दीव', en: 'Dadra and Nagar Haveli and Daman and Diu' },
  '27': { hi: 'महाराष्ट्र', en: 'Maharashtra' },
  '29': { hi: 'कर्नाटक', en: 'Karnataka' },
  '30': { hi: 'गोवा', en: 'Goa' },
  '31': { hi: 'लक्षद्वीप', en: 'Lakshadweep' },
  '32': { hi: 'केरल', en: 'Kerala' },
  '33': { hi: 'तमिलनाडु', en: 'Tamil Nadu' },
  '34': { hi: 'पुडुचेरी', en: 'Puducherry' },
  '35': { hi: 'अंडमान और निकोबार द्वीपसमूह', en: 'Andaman and Nicobar Islands' },
  '36': { hi: 'तेलंगाना', en: 'Telangana' },
  '37': { hi: 'आंध्र प्रदेश', en: 'Andhra Pradesh' },
  '38': { hi: 'लद्दाख', en: 'Ladakh' },
};

export function stateName(code: StateCode, lang: Lang): string {
  return names[code][lang];
}
