class LegalSection {
  const LegalSection({this.heading, required this.bullets});

  final String? heading;
  final List<String> bullets;
}

class LegalPage {
  const LegalPage({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.sections,
  });

  final String id;
  final String title;
  final String subtitle;
  final List<LegalSection> sections;
}

class LegalContent {
  LegalContent._();

  static const subtitle = 'Please Read & Accept Terms And Conditions';

  static const agreement = LegalPage(
    id: 'agreement',
    title: 'Delivery Partner Agreement',
    subtitle: subtitle,
    sections: [
      LegalSection(
        bullets: [
          'All information provided during registration is accurate and complete.',
          'You hold a valid government-issued ID, driving license, and other required documents.',
          'You are responsible for safe, professional, and timely deliveries.',
          'You will treat customers, merchants, and support staff with respect.',
          'You are responsible for vehicle maintenance and safety gear.',
          'You will comply with all traffic rules and local laws.',
        ],
      ),
    ],
  );

  static const terms = LegalPage(
    id: 'terms',
    title: 'Terms & Conditions',
    subtitle: subtitle,
    sections: [
      LegalSection(
        heading: 'General',
        bullets: [
          'You must be at least 18 years old to register as a delivery partner.',
          'You must have valid legal documents as required by TastyKart.',
          'You are responsible for keeping your account secure.',
        ],
      ),
      LegalSection(
        heading: 'Delivery Responsibilities',
        bullets: [
          'Only accept orders you intend to complete.',
          'Deliver food carefully and in the condition it was handed over.',
          'Contact customers professionally when needed.',
          'Follow delivery instructions provided in the app.',
        ],
      ),
    ],
  );

  static const privacy = LegalPage(
    id: 'privacy',
    title: 'Privacy Policy',
    subtitle: subtitle,
    sections: [
      LegalSection(
        heading: 'Information We Collect',
        bullets: [
          'Name, mobile number, email, and profile photo.',
          'Government ID, driving license, and vehicle details.',
          'Bank information for payouts.',
          'GPS location and device information while you are on duty.',
        ],
      ),
      LegalSection(
        heading: 'How We Use Your Information',
        bullets: [
          'To create and manage your delivery partner account.',
          'To assign orders and process earnings.',
          'To verify your identity and documents.',
          'To improve app performance, security, and customer support.',
        ],
      ),
    ],
  );

  static const pages = [agreement, terms, privacy];
}
