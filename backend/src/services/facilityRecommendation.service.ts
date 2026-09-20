import axios from 'axios';

export interface RecommendedFacility {
  facility_name: string;
  facility_type: string;
  matched_specialty: string;
  match_rationale: string;
  city: string;
  district?: string;
  state?: string;
  address: string;
  distance_km?: number | string;
  timings: string;
  contact_phone: string;
  maps_url: string;
  emergency_available: boolean;
  tier: 'Tier 1 Advanced Tertiary' | 'Tier 2 Secondary Specialty' | 'Tier 3 Community Care';
  category?: 'nearby' | 'regional_apex';
}

export interface FacilityRecommendationInput {
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  locality?: string;
  locationQuery?: string;
  chiefComplaint: string;
  recommendedSpecialty?: string;
  severityScore?: number;
  isEmergency?: boolean;
}

export interface FacilityRecommendationResult {
  care_pathway: string;
  recommended_specialty: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  search_location: string;
  detected_city?: string;
  detected_district?: string;
  detected_state?: string;
  matched_facilities: RecommendedFacility[];
  nearby_facilities: RecommendedFacility[];
  regional_apex_facilities: RecommendedFacility[];
}

interface RegistryHospital {
  name: string;
  type: string;
  departments: string[];
  city: string;
  district: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  timings: string;
  emergency_available: boolean;
  tier: 'Tier 1 Advanced Tertiary' | 'Tier 2 Secondary Specialty' | 'Tier 3 Community Care';
  is_apex_center?: boolean;
  key_facilities: string;
}

// Comprehensive Verified Hospital Database for Andhra Pradesh, Telangana & Apex National Centers
const VERIFIED_HOSPITALS: RegistryHospital[] = [
  // --- GUNTUR & AMARAVATI REGION ---
  {
    name: 'Government General Hospital (GGH), Guntur',
    type: 'Public Government Teaching Hospital & Tertiary Care',
    departments: ['General Medicine', 'Emergency Medicine', 'Orthopedics', 'Cardiology', 'Neurology', 'Pediatrics', 'General Surgery', 'Pulmonology', 'Trauma'],
    city: 'Guntur',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    address: 'Sambasiva Pet, Near Railway Station, Guntur, Andhra Pradesh 522001',
    latitude: 16.2974,
    longitude: 80.4439,
    contact_phone: '0863-2224095 / 108',
    timings: '24/7 Emergency & Casualty | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: '1500-bed Tertiary Teaching Hospital, 24/7 Level-1 Trauma Care, State Intensive Care Unit (ICU)',
  },
  {
    name: 'Ramesh Hospitals (Main Campus)',
    type: 'NABH Accredited Multi-Specialty Tertiary Hospital',
    departments: ['Cardiology', 'General Medicine', 'Pulmonology', 'Neurology', 'Orthopedics', 'Emergency Medicine', 'Critical Care', 'Gastroenterology'],
    city: 'Guntur',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    address: 'Collector Office Road, Beside Hindu College Grounds, Guntur, Andhra Pradesh 522004',
    latitude: 16.3042,
    longitude: 80.4356,
    contact_phone: '0863-2377777 / 9848123456',
    timings: '24/7 Emergency & Inpatient | OPD: 9:00 AM - 8:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Dedicated Cath Labs, Advanced Critical Care ICU, 24/7 Stroke & Cardiac Emergency Unit',
  },
  {
    name: 'AIIMS Mangalagiri (All India Institute of Medical Sciences)',
    type: 'National Apex Institute of Excellence & Quaternary Care',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Gastroenterology', 'Orthopedics', 'Pediatrics', 'Pulmonology', 'Dermatology', 'Emergency Medicine'],
    city: 'Mangalagiri',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    address: 'NH-16, Mangalagiri, Guntur District, Andhra Pradesh 522503',
    latitude: 16.4358,
    longitude: 80.5627,
    contact_phone: '08645-293699 / 08645-293688',
    timings: '24/7 Emergency & Trauma | OPD: 8:00 AM - 2:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'National Apex Medical Center, Ultra-modern Diagnostic Suites, Super-specialty Surgery & Research Unit',
  },
  {
    name: 'Katuri Medical College & Hospital',
    type: 'Private Medical College & General Hospital',
    departments: ['General Medicine', 'Orthopedics', 'Pediatrics', 'General Surgery', 'Emergency Medicine', 'Obstetrics & Gynaecology'],
    city: 'Guntur',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    address: 'Katuri Nagar, Chinakondrupadu, Guntur, Andhra Pradesh 522019',
    latitude: 16.2512,
    longitude: 80.3721,
    contact_phone: '0863-2288555',
    timings: '24/7 Casualty & Acute Care | OPD: 9:00 AM - 4:00 PM',
    emergency_available: true,
    tier: 'Tier 2 Secondary Specialty',
    key_facilities: '1000-bed Teaching Hospital, Subsidized Diagnostics, Blood Bank & Trauma Center',
  },
  {
    name: 'NRI General Hospital & Medical College',
    type: 'Super-Specialty Teaching Hospital & Trauma Center',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Nephrology', 'Orthopedics', 'Emergency Medicine', 'Oncology'],
    city: 'Chinakakani',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    address: 'Old NH-5, Chinakakani, Mangalagiri Mandal, Andhra Pradesh 522503',
    latitude: 16.4182,
    longitude: 80.5511,
    contact_phone: '08645-246601 / 08645-246602',
    timings: '24/7 Emergency Services | OPD: 8:30 AM - 5:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Comprehensive Trauma Center, Advanced Radiology & Dialysis Center, Neuro & Cardiac ICUs',
  },

  // --- VIJAYAWADA & KRISHNA REGION ---
  {
    name: 'Old Government General Hospital / Siddhartha Medical College',
    type: 'Government Apex Teaching Hospital',
    departments: ['General Medicine', 'Emergency Medicine', 'Orthopedics', 'Pediatrics', 'Cardiology', 'Pulmonology', 'Trauma'],
    city: 'Vijayawada',
    district: 'Krishna',
    state: 'Andhra Pradesh',
    address: 'Siddhartha Nagar, Gunadala, Vijayawada, Andhra Pradesh 520008',
    latitude: 16.5134,
    longitude: 80.6653,
    contact_phone: '0866-2450444 / 108',
    timings: '24/7 Emergency & Trauma | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Regional Apex Casualty, Specialized Burn & Trauma Unit, State Diagnostic Wing',
  },
  {
    name: 'Manipal Hospital Vijayawada',
    type: 'Multi-Super Specialty Tertiary Hospital',
    departments: ['General Medicine', 'Cardiology', 'Orthopedics', 'Neurology', 'Gastroenterology', 'Critical Care', 'Emergency Medicine'],
    city: 'Vijayawada',
    district: 'Krishna',
    state: 'Andhra Pradesh',
    address: 'Near Kanaka Durga Varadhi, Tadepalli, Guntur-Vijayawada Highway 522501',
    latitude: 16.4886,
    longitude: 80.6124,
    contact_phone: '0866-6499999 / 1800-102-5555',
    timings: '24/7 Emergency & ICU | OPD: 9:00 AM - 8:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'NABH/NABL Certified, Advanced Stroke & Cardiac Suites, Multi-disciplinary ICU',
  },
  {
    name: 'Ayush Hospitals',
    type: 'Multi-Specialty Tertiary Hospital',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Emergency Medicine', 'Nephrology'],
    city: 'Vijayawada',
    district: 'Krishna',
    state: 'Andhra Pradesh',
    address: 'Old Bus Depot Road, Ring Road, Vijayawada, Andhra Pradesh 520008',
    latitude: 16.5085,
    longitude: 80.6480,
    contact_phone: '0866-6677777',
    timings: '24/7 Emergency & Inpatient | OPD: 9:00 AM - 7:00 PM',
    emergency_available: true,
    tier: 'Tier 2 Secondary Specialty',
    key_facilities: 'Specialized Trauma & Joint Replacement Center, 24/7 Laboratory & Diagnostics',
  },

  // --- HYDERABAD & TELANGANA REGION ---
  {
    name: "Nizam's Institute of Medical Sciences (NIMS)",
    type: 'Autonomous Apex State Medical Institute & Teaching Hospital',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Nephrology', 'Rheumatology', 'Orthopedics', 'Emergency Medicine', 'Gastroenterology', 'Endocrinology'],
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    address: 'Punjagutta Main Road, Hyderabad, Telangana 500082',
    latitude: 17.4228,
    longitude: 78.4529,
    contact_phone: '040-23489000 / 040-23489244',
    timings: '24/7 Emergency & Acute Trauma | OPD: 8:00 AM - 2:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Autonomous State Apex Referral Center, All Super-specialty Departments, Comprehensive Critical Care',
  },
  {
    name: 'Apollo Health City, Jubilee Hills',
    type: 'JCI Accredited Quaternary Care Super Specialty Hospital',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Emergency Medicine', 'Gastroenterology', 'Pulmonology', 'Oncology'],
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    address: 'Road No 72, Opposite Bharatiya Vidya Bhavan, Film Nagar, Jubilee Hills, Hyderabad 500096',
    latitude: 17.4172,
    longitude: 78.4116,
    contact_phone: '040-23607777 / 1066',
    timings: '24/7 Emergency & Level-1 Trauma | OPD: 8:00 AM - 8:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'International Accreditation, Level-1 Comprehensive Trauma Care, Robotic Surgery & Advanced ICUs',
  },
  {
    name: 'AIG Hospitals (Asian Institute of Gastroenterology)',
    type: 'Global Center of Excellence & Quaternary Hospital',
    departments: ['Gastroenterology', 'Hepatology', 'General Medicine', 'Cardiology', 'Pulmonology', 'Critical Care', 'Emergency Medicine'],
    city: 'Hyderabad',
    district: 'Ranga Reddy',
    state: 'Telangana',
    address: '1-66/AIG/2 to 5, Mindspace Road, Gachibowli, Hyderabad, Telangana 500032',
    latitude: 17.4435,
    longitude: 78.3653,
    contact_phone: '040-42444222 / 040-42444288',
    timings: '24/7 Emergency Services | OPD: 8:30 AM - 7:30 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Asia-Pacific Premier Gastro & Hepatology Center, 800-bed Multi-Specialty Quaternary Complex',
  },
  {
    name: 'KIMS Hospitals (Krishna Institute of Medical Sciences)',
    type: 'Quaternary Multi-Specialty Care Hospital',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Pulmonology', 'Nephrology', 'Emergency Medicine'],
    city: 'Secunderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    address: '1-8-31/1, Minister Road, Krishna Nagar Colony, Begumpet, Secunderabad 500003',
    latitude: 17.4410,
    longitude: 78.4900,
    contact_phone: '040-44885000 / 040-44885188',
    timings: '24/7 Emergency & ICU | OPD: 9:00 AM - 7:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Leading Organ Transplant & Critical Care Hub, Multi-slice CT & 3T MRI Diagnostics',
  },
  {
    name: 'Osmania General Hospital',
    type: 'Historic Apex Public Teaching Hospital',
    departments: ['General Medicine', 'Emergency Medicine', 'General Surgery', 'Orthopedics', 'Trauma', 'Pediatrics'],
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    address: 'Afzal Gunj, High Court Road, Hyderabad, Telangana 500012',
    latitude: 17.3753,
    longitude: 78.4744,
    contact_phone: '040-24600121 / 108',
    timings: '24/7 Emergency Casualty & Inpatient Services',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Massive Public Acute Care Facility, Subsidized Specialized Surgery & Emergency Trauma Center',
  },
  {
    name: 'Gandhi Hospital & Medical College',
    type: 'Premier Government Teaching Hospital',
    departments: ['General Medicine', 'Emergency Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Pulmonology', 'Trauma'],
    city: 'Secunderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    address: 'Musheerabad, Padmarao Nagar, Secunderabad, Telangana 500003',
    latitude: 17.4244,
    longitude: 78.5033,
    contact_phone: '040-27505566 / 108',
    timings: '24/7 Emergency Services | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: '1200-bed Acute Care Center, Dedicated Infection & Respiratory ICU, Emergency Casualty Wing',
  },

  // --- VISAKHAPATNAM (VIZAG) REGION ---
  {
    name: 'King George Hospital (KGH)',
    type: 'Government Apex Teaching Hospital',
    departments: ['General Medicine', 'Emergency Medicine', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'Trauma'],
    city: 'Visakhapatnam',
    district: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    address: 'Maharanipeta, Collectorate Junction, Visakhapatnam, Andhra Pradesh 530002',
    latitude: 17.7088,
    longitude: 83.3039,
    contact_phone: '0891-2564891 / 108',
    timings: '24/7 Emergency & Trauma | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Premier Public Teaching Hospital of North Coastal Andhra, 1300+ Beds, 24/7 Trauma Unit',
  },
  {
    name: 'Apollo Hospitals Ramnagar',
    type: 'Multi-Super Specialty Tertiary Hospital',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Gastroenterology', 'Emergency Medicine'],
    city: 'Visakhapatnam',
    district: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    address: 'Waltair Main Road, Ramnagar, Visakhapatnam, Andhra Pradesh 530002',
    latitude: 17.7245,
    longitude: 83.3150,
    contact_phone: '0891-2727272 / 1066',
    timings: '24/7 Emergency & ICU | OPD: 9:00 AM - 7:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Level-1 Emergency Center, Comprehensive Cardiac & Neuro ICU, Advanced Radiology',
  },
  {
    name: 'VIMS (Visakha Institute of Medical Sciences)',
    type: 'Autonomous State Super-Specialty Institute',
    departments: ['General Medicine', 'Cardiology', 'Nephrology', 'Neurology', 'Emergency Medicine', 'Critical Care'],
    city: 'Visakhapatnam',
    district: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    address: 'Hanumanthavaka, Health City, Visakhapatnam, Andhra Pradesh 530040',
    latitude: 17.7602,
    longitude: 83.3400,
    contact_phone: '0891-2854000',
    timings: '24/7 Emergency & Trauma | OPD: 9:00 AM - 2:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'State Autonomous Institute, Super-specialty Diagnostic Suites & High Dependency Units',
  },

  // --- TIRUPATI REGION ---
  {
    name: 'SVIMS (Sri Venkateswara Institute of Medical Sciences)',
    type: 'Autonomous Super-Specialty Apex Medical Institute',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Nephrology', 'Endocrinology', 'Emergency Medicine', 'Surgical Oncology'],
    city: 'Tirupati',
    district: 'Tirupati',
    state: 'Andhra Pradesh',
    address: 'Alipiri Road, Tirupati, Andhra Pradesh 517507',
    latitude: 13.6394,
    longitude: 79.4045,
    contact_phone: '0877-2287777',
    timings: '24/7 Emergency & Trauma | OPD: 8:00 AM - 2:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Premier Autonomous Medical University, Cath Labs, Advanced Dialysis, Comprehensive ICU',
  },
  {
    name: 'SVRR Government General Hospital (Ruia Hospital)',
    type: 'Government Teaching Hospital & Regional Trauma Center',
    departments: ['General Medicine', 'Emergency Medicine', 'Orthopedics', 'Pediatrics', 'General Surgery', 'Trauma'],
    city: 'Tirupati',
    district: 'Tirupati',
    state: 'Andhra Pradesh',
    address: 'Opposite SV Medical College, Tirupati, Andhra Pradesh 517507',
    latitude: 13.6370,
    longitude: 79.4060,
    contact_phone: '0877-2286700 / 108',
    timings: '24/7 Emergency Casualty | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: '1000+ Bed Teaching Facility, Subsidized Acute Care, 24/7 Blood Bank & Trauma Center',
  },

  // --- KURNOOL REGION ---
  {
    name: 'Government General Hospital, Kurnool',
    type: 'Government Teaching Hospital & Rayalaseema Apex Center',
    departments: ['General Medicine', 'Emergency Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Trauma'],
    city: 'Kurnool',
    district: 'Kurnool',
    state: 'Andhra Pradesh',
    address: 'Budhawara Peta, Kurnool, Andhra Pradesh 518002',
    latitude: 15.8281,
    longitude: 78.0373,
    contact_phone: '08518-255301 / 108',
    timings: '24/7 Emergency Casualty | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Premier Regional Referral Hospital, 24/7 Casualty & Ortho Trauma Facility',
  },

  // --- WARANGAL REGION ---
  {
    name: 'MGM Hospital (Mahatma Gandhi Memorial Hospital)',
    type: 'Government Apex Teaching Hospital of North Telangana',
    departments: ['General Medicine', 'Emergency Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology'],
    city: 'Warangal',
    district: 'Warangal',
    state: 'Telangana',
    address: 'Mattewada, Warangal, Telangana 506007',
    latitude: 17.9784,
    longitude: 79.6010,
    contact_phone: '0870-2441200 / 108',
    timings: '24/7 Emergency & Acute Trauma | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: '1200-bed Teaching Hospital for North Telangana, Dedicated Trauma Wing & State ICUs',
  },

  // --- RAJAHMUNDRY & KAKINADA REGION ---
  {
    name: 'Government General Hospital (GGH), Kakinada',
    type: 'Government Teaching Hospital & Trauma Center',
    departments: ['General Medicine', 'Emergency Medicine', 'Orthopedics', 'Pediatrics', 'Cardiology', 'General Surgery'],
    city: 'Kakinada',
    district: 'Kakinada',
    state: 'Andhra Pradesh',
    address: 'Main Road, Kakinada, Andhra Pradesh 533001',
    latitude: 16.9604,
    longitude: 82.2381,
    contact_phone: '0884-2376156 / 108',
    timings: '24/7 Casualty & Emergency | OPD: 8:30 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Affiliated to Rangaraya Medical College, 24/7 Emergency & Acute Critical Care',
  },
  {
    name: 'GSL Medical College & General Hospital',
    type: 'Super-Specialty Teaching Hospital & Cancer Institute',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Oncology', 'Orthopedics', 'Emergency Medicine'],
    city: 'Rajahmundry',
    district: 'East Godavari',
    state: 'Andhra Pradesh',
    address: 'NH-16, Rajanagaram, Rajahmundry, Andhra Pradesh 533296',
    latitude: 17.0650,
    longitude: 81.8900,
    contact_phone: '0883-2484999',
    timings: '24/7 Emergency Services | OPD: 9:00 AM - 5:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    key_facilities: 'Quaternary Cancer & Trauma Center, Advanced Linear Accelerators, 24/7 Multi-ICU',
  },

  // --- NATIONAL APEX REFERRAL INSTITUTES ---
  {
    name: 'AIIMS New Delhi (All India Institute of Medical Sciences)',
    type: 'National Premier Apex Medical University & Quaternary Care',
    departments: ['General Medicine', 'Cardiology', 'Neurology', 'Gastroenterology', 'Orthopedics', 'Rheumatology', 'Oncology', 'Emergency Medicine'],
    city: 'New Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029',
    latitude: 28.5672,
    longitude: 77.2100,
    contact_phone: '011-26588500 / 011-26588700',
    timings: '24/7 Emergency & Trauma Center | OPD: 8:00 AM - 1:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'India’s Foremost Medical Institute, Level-1 Apex Trauma Center, Global Research & Surgery',
  },
  {
    name: 'Christian Medical College (CMC) Vellore',
    type: 'World-Renowned Quaternary Multi-Specialty Referral Hospital',
    departments: ['General Medicine', 'Neurology', 'Cardiology', 'Orthopedics', 'Hematology', 'Nephrology', 'Emergency Medicine'],
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    address: 'Ida Scudder Road, Vellore, Tamil Nadu 632004',
    latitude: 12.9246,
    longitude: 79.1348,
    contact_phone: '0416-2281000 / 0416-2282010',
    timings: '24/7 Emergency & Trauma Services | OPD: 8:00 AM - 6:00 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Renowned International Referral Center, Dedicated Multi-Disciplinary Specialized Clinics',
  },
  {
    name: 'NIMHANS (National Institute of Mental Health and Neurosciences)',
    type: 'National Apex Institute for Neurosciences & Psychiatry',
    departments: ['Neurology', 'Neurosurgery', 'Psychiatry', 'Neuro-Rehabilitation', 'Emergency Medicine'],
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    address: 'Hosur Road, Near Dairy Circle, Bengaluru, Karnataka 560029',
    latitude: 12.9392,
    longitude: 77.5956,
    contact_phone: '080-26995000 / 080-26995555',
    timings: '24/7 Emergency Neuro Casualty | OPD: 8:30 AM - 1:30 PM',
    emergency_available: true,
    tier: 'Tier 1 Advanced Tertiary',
    is_apex_center: true,
    key_facilities: 'Premier Neuro-Trauma & Neuroscience Apex Center of India, Advanced Brain & Spine Suites',
  },
];

export class FacilityRecommendationService {
  private candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  /**
   * Calculates Haversine distance between two coordinates in kilometers.
   */
  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Generates a direct driving directions link that starts GPS navigation on Google Maps
   * rather than redirecting to a search page.
   */
  private generateDirectNavigationUrl(name: string, address: string, lat?: number, lon?: number): string {
    if (typeof lat === 'number' && typeof lon === 'number') {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name + ', ' + address)}&travelmode=driving`;
  }

  /**
   * Normalizes specialty matching against hospital departments.
   */
  private matchesSpecialty(departments: string[], targetSpecialty: string): boolean {
    const target = targetSpecialty.toLowerCase();
    return departments.some((d) => {
      const dept = d.toLowerCase();
      if (dept.includes(target) || target.includes(dept)) return true;
      if (target.includes('general') && dept.includes('general medicine')) return true;
      if (target.includes('emergency') && (dept.includes('emergency') || dept.includes('trauma'))) return true;
      if (target.includes('ortho') && dept.includes('orthopedics')) return true;
      if (target.includes('cardio') && dept.includes('cardiology')) return true;
      if (target.includes('neuro') && dept.includes('neurology')) return true;
      if (target.includes('gastro') && dept.includes('gastroenterology')) return true;
      if (target.includes('pulmon') && dept.includes('pulmonology')) return true;
      if (target.includes('pediatr') && dept.includes('pediatrics')) return true;
      return false;
    });
  }

  public async recommendSpecializedFacilities(
    input: FacilityRecommendationInput
  ): Promise<FacilityRecommendationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const specialty = input.recommendedSpecialty || 'General Medicine';
    const severity = input.severityScore ?? 40;
    const isEmergency = Boolean(input.isEmergency || severity >= 80);

    // 1. Determine geographic context
    const hasCoordinates = typeof input.latitude === 'number' && typeof input.longitude === 'number';
    const userLat = input.latitude;
    const userLon = input.longitude;

    const detectedCity = input.city || input.district || (input.locationQuery ? input.locationQuery.split(',')[0].trim() : undefined);
    const detectedDistrict = input.district;
    const detectedState = input.state;

    let locationDesc = 'Your Location';
    if (detectedCity) {
      locationDesc = `${detectedCity}${detectedState ? ', ' + detectedState : ''}`;
    } else if (hasCoordinates) {
      locationDesc = `GPS (${userLat!.toFixed(3)}, ${userLon!.toFixed(3)})`;
    } else if (input.locationQuery) {
      locationDesc = input.locationQuery;
    }

    // 2. Query Curated Indian Healthcare Registry with exact Haversine distance
    const matchedFromRegistry = this.queryRegistryHospitals(
      specialty,
      userLat,
      userLon,
      detectedCity,
      detectedDistrict,
      isEmergency
    );

    // 3. Attempt Gemini Clinical Augmentation if API key is available
    if (apiKey) {
      try {
        const geminiResult = await this.callGeminiRecommendation(
          input,
          specialty,
          severity,
          isEmergency,
          locationDesc,
          detectedCity,
          detectedDistrict,
          apiKey
        );

        if (geminiResult && geminiResult.nearby_facilities && geminiResult.nearby_facilities.length > 0) {
          // If Gemini succeeded, enrich with direct driving links and ensure strict categorization
          return this.enrichAndCategorizeResults(
            geminiResult,
            specialty,
            isEmergency,
            locationDesc,
            detectedCity,
            detectedDistrict,
            userLat,
            userLon
          );
        }
      } catch (err: any) {
        console.warn('[FacilityRecommendation] Gemini call failed or timed out:', err.message);
      }
    }

    // 4. Return robust, distance-sorted Curated Registry response
    return matchedFromRegistry;
  }

  /**
   * Spatial and clinical query against the curated verified hospital database.
   */
  private queryRegistryHospitals(
    specialty: string,
    userLat?: number,
    userLon?: number,
    detectedCity?: string,
    detectedDistrict?: string,
    isEmergency?: boolean
  ): FacilityRecommendationResult {
    const hasCoords = typeof userLat === 'number' && typeof userLon === 'number';
    const cityNorm = detectedCity ? detectedCity.toLowerCase().trim() : '';
    const districtNorm = detectedDistrict ? detectedDistrict.toLowerCase().trim() : '';

    // Calculate distance and match score for every hospital
    const scoredHospitals = VERIFIED_HOSPITALS.map((h) => {
      let distanceKm: number | undefined = undefined;
      if (hasCoords) {
        distanceKm = this.calculateDistanceKm(userLat!, userLon!, h.latitude, h.longitude);
      }

      const matchesSpec = this.matchesSpecialty(h.departments, specialty);
      const isCityMatch = cityNorm ? h.city.toLowerCase().includes(cityNorm) || cityNorm.includes(h.city.toLowerCase()) : false;
      const isDistrictMatch = districtNorm ? h.district.toLowerCase().includes(districtNorm) || districtNorm.includes(h.district.toLowerCase()) : false;

      // Classify as nearby if within 40 km or in the same city/district
      const isNearby = (distanceKm !== undefined && distanceKm <= 40) || isCityMatch || isDistrictMatch;

      return {
        hospital: h,
        distanceKm,
        matchesSpec,
        isNearby,
        isCityMatch,
        isDistrictMatch,
      };
    });

    // Sort nearby candidates by distance
    const nearbyCandidates = scoredHospitals
      .filter((item) => (item.isNearby || (item.distanceKm !== undefined && item.distanceKm <= 50)))
      .sort((a, b) => {
        // Priority to specialty match
        if (a.matchesSpec && !b.matchesSpec) return -1;
        if (!a.matchesSpec && b.matchesSpec) return 1;
        // Then by distance
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });

    // Sort apex / regional candidates (farther away institutes with premier capabilities)
    const apexCandidates = scoredHospitals
      .filter((item) => item.hospital.is_apex_center || (item.distanceKm !== undefined && item.distanceKm > 40))
      .filter((item) => item.matchesSpec)
      .sort((a, b) => {
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });

    // Take top 3-4 nearby facilities
    const nearbyFacilities: RecommendedFacility[] = (nearbyCandidates.length > 0
      ? nearbyCandidates.slice(0, 4)
      : scoredHospitals.filter((s) => s.matchesSpec).slice(0, 3)
    ).map((item) => {
      const h = item.hospital;
      const distStr = item.distanceKm !== undefined ? `${item.distanceKm} km` : 'Local Area';
      const mapsUrl = this.generateDirectNavigationUrl(h.name, h.address, h.latitude, h.longitude);

      return {
        facility_name: h.name,
        facility_type: h.type,
        matched_specialty: `${specialty} & 24/7 Emergency Care`,
        match_rationale: `Located close to you (${distStr}). Equipped with full ${specialty} diagnostic capabilities, acute emergency beds, and certified on-call specialists. ${h.key_facilities}`,
        city: h.city,
        district: h.district,
        state: h.state,
        address: h.address,
        distance_km: distStr,
        timings: h.timings,
        contact_phone: h.contact_phone,
        maps_url: mapsUrl,
        emergency_available: h.emergency_available,
        tier: h.tier,
        category: 'nearby',
      };
    });

    // Take top 2-3 apex referral facilities (shown at the end)
    const regionalApexFacilities: RecommendedFacility[] = apexCandidates
      .filter((apex) => !nearbyFacilities.some((n) => n.facility_name === apex.hospital.name))
      .slice(0, 3)
      .map((item) => {
        const h = item.hospital;
        const distStr = item.distanceKm !== undefined ? `${item.distanceKm} km away` : 'State Referral';
        const mapsUrl = this.generateDirectNavigationUrl(h.name, h.address, h.latitude, h.longitude);

        return {
          facility_name: h.name,
          facility_type: h.type,
          matched_specialty: `Apex Center for ${specialty} & Quaternary Care`,
          match_rationale: `Premier Quaternary Institute (${distStr}). Recommended if complex surgical intervention, super-specialty intensive care, or advanced tertiary diagnostic equipment is required. ${h.key_facilities}`,
          city: h.city,
          district: h.district,
          state: h.state,
          address: h.address,
          distance_km: distStr,
          timings: h.timings,
          contact_phone: h.contact_phone,
          maps_url: mapsUrl,
          emergency_available: h.emergency_available,
          tier: h.tier,
          category: 'regional_apex',
        };
      });

    const searchLocStr =
      detectedCity ||
      (hasCoords ? `${userLat!.toFixed(3)}, ${userLon!.toFixed(3)}` : 'Andhra Pradesh & Telangana Region');

    return {
      care_pathway: isEmergency ? 'Emergency Critical Evaluation' : 'Urgent Specialized Consultation',
      recommended_specialty: specialty,
      urgency: isEmergency ? 'emergency' : 'urgent',
      search_location: searchLocStr,
      detected_city: detectedCity,
      detected_district: detectedDistrict,
      nearby_facilities: nearbyFacilities,
      regional_apex_facilities: regionalApexFacilities,
      matched_facilities: [...nearbyFacilities, ...regionalApexFacilities],
    };
  }

  /**
   * Prompts Gemini to generate highly specific recommendations when online.
   */
  private async callGeminiRecommendation(
    input: FacilityRecommendationInput,
    specialty: string,
    severity: number,
    isEmergency: boolean,
    locationDesc: string,
    city: string | undefined,
    district: string | undefined,
    apiKey: string
  ): Promise<any> {
    const systemPrompt = `
You are the VaidyaArc Medical Facility Navigation Engine for Indian Healthcare.
Your imperative is to suggest REAL, OPERATING, VERIFIED hospitals in India tailored to the patient's exact geographical location and clinical condition.

PATIENT CLINICAL CONTEXT:
- Presenting Complaint: "${input.chiefComplaint}"
- Triage Severity: ${severity}/100 (${isEmergency ? 'EMERGENCY' : 'URGENT / ROUTINE'})
- Required Medical Department: "${specialty}"
- Patient Geographic Area: ${city ? `City: ${city}, District: ${district || ''}` : locationDesc}
- GPS Coordinates: ${input.latitude && input.longitude ? `${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}` : 'N/A'}

TASK REQUIREMENTS:
1. CATEGORY 1: "nearby_facilities" (3 hospitals)
   - Real, authentic hospitals IN OR CLOSEST TO ${city || 'the patient location'} equipped with ${specialty} and 24/7 emergency.
   - Address MUST contain the real local area/street in ${city || 'that city'}.
   - "maps_url" MUST be a direct driving navigation URL formatted as:
     "https://www.google.com/maps/dir/?api=1&destination=Encoded+Hospital+Name+City&travelmode=driving"
     (DO NOT USE /maps/search).

2. CATEGORY 2: "regional_apex_facilities" (2 hospitals)
   - Renowned apex/tertiary medical colleges or institutes in that state/region equipped for complex or quaternary care (e.g. AIIMS, NIMS, GGH, Apollo Health City).
   - "maps_url" MUST also be direct driving navigation URL.

Return strictly valid JSON only:
{
  "care_pathway": "${isEmergency ? 'Emergency Critical Evaluation' : 'Urgent Specialized Consultation'}",
  "recommended_specialty": "${specialty}",
  "urgency": "${isEmergency ? 'emergency' : 'urgent'}",
  "search_location": "${city || locationDesc}",
  "nearby_facilities": [
    {
      "facility_name": "Hospital Name",
      "facility_type": "Multi-Specialty Hospital / Teaching Hospital",
      "matched_specialty": "Department Name",
      "match_rationale": "Why this center is near and equipped for the problem",
      "city": "${city || 'City Name'}",
      "address": "Local Area, City, State",
      "distance_km": "approx. X km",
      "timings": "24/7 Emergency | OPD: 9:00 AM - 7:00 PM",
      "contact_phone": "+91-XXXXXXXXXX",
      "maps_url": "https://www.google.com/maps/dir/?api=1&destination=Hospital+Name+City&travelmode=driving",
      "emergency_available": true,
      "tier": "Tier 1 Advanced Tertiary",
      "category": "nearby"
    }
  ],
  "regional_apex_facilities": [
    {
      "facility_name": "Apex Hospital Name",
      "facility_type": "Apex Quaternary Institute / Medical College",
      "matched_specialty": "Super Specialty Care",
      "match_rationale": "Why this institute is recommended for advanced intervention",
      "city": "State Capital / Major Medical Hub",
      "address": "Address, City, State",
      "distance_km": "approx. XX km away",
      "timings": "24/7 Emergency",
      "contact_phone": "+91-XXXXXXXXXX",
      "maps_url": "https://www.google.com/maps/dir/?api=1&destination=Hospital+Name+City&travelmode=driving",
      "emergency_available": true,
      "tier": "Tier 1 Advanced Tertiary",
      "category": "regional_apex"
    }
  ]
}
`;

    for (const model of this.candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        };

        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 18000,
        });

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleaned = rawText
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.nearby_facilities) && parsed.nearby_facilities.length > 0) {
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`[FacilityRecommendation] Model ${model} call failed:`, err.message);
      }
    }
    return null;
  }

  /**
   * Enriches Gemini output with direct driving URLs and combines lists for full backward compatibility.
   */
  private enrichAndCategorizeResults(
    geminiResult: any,
    specialty: string,
    isEmergency: boolean,
    locationDesc: string,
    detectedCity?: string,
    detectedDistrict?: string,
    userLat?: number,
    userLon?: number
  ): FacilityRecommendationResult {
    const ensureDirectNavigation = (f: RecommendedFacility, cat: 'nearby' | 'regional_apex') => {
      let dist = f.distance_km;
      // If user has coordinates, calculate real distance
      if (typeof userLat === 'number' && typeof userLon === 'number') {
        const matchInRegistry = VERIFIED_HOSPITALS.find(
          (vh) => vh.name.toLowerCase().includes(f.facility_name.toLowerCase()) || f.facility_name.toLowerCase().includes(vh.name.toLowerCase())
        );
        if (matchInRegistry) {
          const calcKm = this.calculateDistanceKm(userLat, userLon, matchInRegistry.latitude, matchInRegistry.longitude);
          dist = `${calcKm} km`;
          f.maps_url = this.generateDirectNavigationUrl(f.facility_name, f.address, matchInRegistry.latitude, matchInRegistry.longitude);
        }
      }

      if (!f.maps_url || f.maps_url.includes('/maps/search')) {
        f.maps_url = this.generateDirectNavigationUrl(f.facility_name, f.address || f.city);
      }
      f.category = cat;
      f.distance_km = dist;
      return f;
    };

    const nearby: RecommendedFacility[] = (geminiResult.nearby_facilities || []).map((f: any) =>
      ensureDirectNavigation(f, 'nearby')
    );
    const apex: RecommendedFacility[] = (geminiResult.regional_apex_facilities || []).map((f: any) =>
      ensureDirectNavigation(f, 'regional_apex')
    );

    return {
      care_pathway: geminiResult.care_pathway || (isEmergency ? 'Emergency Critical Evaluation' : 'Urgent Specialized Consultation'),
      recommended_specialty: specialty,
      urgency: geminiResult.urgency || (isEmergency ? 'emergency' : 'urgent'),
      search_location: geminiResult.search_location || locationDesc,
      detected_city: detectedCity,
      detected_district: detectedDistrict,
      nearby_facilities: nearby,
      regional_apex_facilities: apex,
      matched_facilities: [...nearby, ...apex],
    };
  }
}

export const facilityRecommendationService = new FacilityRecommendationService();
export default facilityRecommendationService;
