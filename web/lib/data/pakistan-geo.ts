/**
 * Pakistan Administrative Divisions — Hierarchical Lookup
 *
 * Structure: Province → District → Tehsil → City[]
 *
 * Used by cascading selects in the onboarding contact-address form.
 * Expand entries as needed — the UI derives dropdown options from this file.
 */

export type PakistanGeo = Record<string, Record<string, Record<string, string[]>>>;

export const PAKISTAN_GEO: PakistanGeo = {
  // ═══════════════════════════════════════════════════════════════
  // PUNJAB
  // ═══════════════════════════════════════════════════════════════
  Punjab: {
    Attock: {
      Attock: ["Attock City"],
      "Fateh Jang": ["Fateh Jang"],
      Hazro: ["Hazro"],
      Jand: ["Jand"],
      Pindigheb: ["Pindigheb"],
    },
    Bahawalnagar: {
      Bahawalnagar: ["Bahawalnagar"],
      Chishtian: ["Chishtian"],
      "Fort Abbas": ["Fort Abbas"],
      Haroonabad: ["Haroonabad"],
      Minchinabad: ["Minchinabad"],
    },
    Bahawalpur: {
      "Bahawalpur City": ["Bahawalpur"],
      "Bahawalpur Sadar": ["Bahawalpur Sadar"],
      "Ahmadpur East": ["Ahmadpur East"],
      Hasilpur: ["Hasilpur"],
      "Khairpur Tamewali": ["Khairpur Tamewali"],
      Yazman: ["Yazman"],
    },
    Bhakkar: {
      Bhakkar: ["Bhakkar"],
      "Darya Khan": ["Darya Khan"],
      "Kalur Kot": ["Kalur Kot"],
      Mankera: ["Mankera"],
    },
    Chakwal: {
      Chakwal: ["Chakwal"],
      "Choa Saidan Shah": ["Choa Saidan Shah"],
      "Kallar Kahar": ["Kallar Kahar"],
      Lawa: ["Lawa"],
      Talagang: ["Talagang"],
    },
    Chiniot: {
      Chiniot: ["Chiniot"],
      Bhowana: ["Bhowana"],
      Lalian: ["Lalian"],
    },
    "Dera Ghazi Khan": {
      "Dera Ghazi Khan": ["Dera Ghazi Khan"],
      Taunsa: ["Taunsa Sharif"],
      "Tribal Area": ["Tribal Area"],
    },
    Faisalabad: {
      "Faisalabad City": ["Faisalabad"],
      "Faisalabad Sadar": ["Faisalabad Sadar"],
      "Chak Jhumra": ["Chak Jhumra"],
      Jaranwala: ["Jaranwala"],
      Sammundri: ["Sammundri"],
      Tandlianwala: ["Tandlianwala"],
    },
    Gujranwala: {
      "Gujranwala City": ["Gujranwala"],
      "Gujranwala Sadar": ["Gujranwala Sadar"],
      Kamoke: ["Kamoke"],
      "Nowshera Virkan": ["Nowshera Virkan"],
      Wazirabad: ["Wazirabad"],
    },
    Gujrat: {
      Gujrat: ["Gujrat"],
      Kharian: ["Kharian"],
      "Sara-e-Alamgir": ["Sara-e-Alamgir"],
    },
    Hafizabad: {
      Hafizabad: ["Hafizabad"],
      "Pindi Bhattian": ["Pindi Bhattian"],
    },
    Jhang: {
      Jhang: ["Jhang City"],
      "Ahmadpur Sial": ["Ahmadpur Sial"],
      Shorkot: ["Shorkot"],
      "18 Hazari": ["18 Hazari"],
    },
    Jhelum: {
      Jhelum: ["Jhelum"],
      Dina: ["Dina"],
      "Pind Dadan Khan": ["Pind Dadan Khan"],
      Sohawa: ["Sohawa"],
    },
    Kasur: {
      Kasur: ["Kasur"],
      Chunian: ["Chunian"],
      "Kot Radha Kishan": ["Kot Radha Kishan"],
      Pattoki: ["Pattoki"],
    },
    Khanewal: {
      Khanewal: ["Khanewal"],
      Jahanian: ["Jahanian"],
      Kabirwala: ["Kabirwala"],
      "Mian Channu": ["Mian Channu"],
    },
    Khushab: {
      Khushab: ["Jauharabad", "Khushab"],
      Noorpur: ["Noorpur Thal"],
      Quaidabad: ["Quaidabad"],
    },
    Lahore: {
      "Lahore City": ["Lahore"],
      "Lahore Cantt": ["Lahore Cantt"],
      "Model Town": ["Model Town"],
      Raiwind: ["Raiwind"],
      Shalimar: ["Shalimar"],
    },
    Layyah: {
      Layyah: ["Layyah"],
      Chaubara: ["Chaubara"],
      "Karor Lal Esan": ["Karor Lal Esan"],
    },
    Lodhran: {
      Lodhran: ["Lodhran"],
      Duniyapur: ["Duniyapur"],
      "Kahror Pacca": ["Kahror Pacca"],
    },
    "Mandi Bahauddin": {
      "Mandi Bahauddin": ["Mandi Bahauddin"],
      Malakwal: ["Malakwal"],
      Phalia: ["Phalia"],
    },
    Mianwali: {
      Mianwali: ["Mianwali"],
      Isakhel: ["Isakhel"],
      Piplan: ["Piplan"],
    },
    Multan: {
      "Multan City": ["Multan"],
      "Multan Sadar": ["Multan Sadar"],
      "Jalalpur Pirwala": ["Jalalpur Pirwala"],
      Shujabad: ["Shujabad"],
    },
    Muzaffargarh: {
      Muzaffargarh: ["Muzaffargarh"],
      Alipur: ["Alipur"],
      Jatoi: ["Jatoi"],
      "Kot Addu": ["Kot Addu"],
    },
    "Nankana Sahib": {
      "Nankana Sahib": ["Nankana Sahib"],
      "Sangla Hill": ["Sangla Hill"],
      Shahkot: ["Shahkot"],
    },
    Narowal: {
      Narowal: ["Narowal"],
      Shakargarh: ["Shakargarh"],
      Zafarwal: ["Zafarwal"],
    },
    Okara: {
      Okara: ["Okara"],
      Depalpur: ["Depalpur"],
      "Renala Khurd": ["Renala Khurd"],
    },
    Pakpattan: {
      Pakpattan: ["Pakpattan"],
      Arifwala: ["Arifwala"],
    },
    "Rahim Yar Khan": {
      "Rahim Yar Khan": ["Rahim Yar Khan"],
      Khanpur: ["Khanpur"],
      Liaqatpur: ["Liaqatpur"],
      Sadiqabad: ["Sadiqabad"],
    },
    Rajanpur: {
      Rajanpur: ["Rajanpur"],
      Jampur: ["Jampur"],
      Rojhan: ["Rojhan"],
    },
    Rawalpindi: {
      Rawalpindi: ["Rawalpindi"],
      "Gujar Khan": ["Gujar Khan"],
      Kahuta: ["Kahuta"],
      "Kallar Syedan": ["Kallar Syedan"],
      "Kotli Sattian": ["Kotli Sattian"],
      Murree: ["Murree"],
      Taxila: ["Taxila", "Wah Cantt"],
    },
    Sahiwal: {
      Sahiwal: ["Sahiwal"],
      Chichawatni: ["Chichawatni"],
    },
    Sargodha: {
      Sargodha: ["Sargodha"],
      Bhalwal: ["Bhalwal"],
      "Kot Momin": ["Kot Momin"],
      Shahpur: ["Shahpur"],
      Sillanwali: ["Sillanwali"],
    },
    Sheikhupura: {
      Sheikhupura: ["Sheikhupura"],
      Ferozewala: ["Ferozewala"],
      Muridke: ["Muridke"],
      Safdarabad: ["Safdarabad"],
      "Sharaqpur Sharif": ["Sharaqpur Sharif"],
    },
    Sialkot: {
      Sialkot: ["Sialkot"],
      Daska: ["Daska"],
      Pasrur: ["Pasrur"],
      Sambrial: ["Sambrial"],
    },
    "Toba Tek Singh": {
      "Toba Tek Singh": ["Toba Tek Singh"],
      Gojra: ["Gojra"],
      Kamalia: ["Kamalia"],
      Pirmahal: ["Pirmahal"],
    },
    Vehari: {
      Vehari: ["Vehari"],
      Burewala: ["Burewala"],
      Mailsi: ["Mailsi"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SINDH
  // ═══════════════════════════════════════════════════════════════
  Sindh: {
    Badin: {
      Badin: ["Badin"],
      Matli: ["Matli"],
      "Talhar": ["Talhar"],
      "Tando Bago": ["Tando Bago"],
    },
    Dadu: {
      Dadu: ["Dadu"],
      "Mehar": ["Mehar"],
      "Johi": ["Johi"],
      "Khairpur Nathan Shah": ["Khairpur Nathan Shah"],
    },
    Ghotki: {
      Ghotki: ["Ghotki"],
      Daharki: ["Daharki"],
      "Mirpur Mathelo": ["Mirpur Mathelo"],
      Ubauro: ["Ubauro"],
    },
    Hyderabad: {
      "Hyderabad City": ["Hyderabad"],
      "Hyderabad Rural": ["Hyderabad Rural"],
      Latifabad: ["Latifabad"],
      Qasimabad: ["Qasimabad"],
    },
    Jacobabad: {
      Jacobabad: ["Jacobabad"],
      "Garhi Khairo": ["Garhi Khairo"],
      Thul: ["Thul"],
    },
    Jamshoro: {
      Jamshoro: ["Jamshoro"],
      "Kotri": ["Kotri"],
      Manjhand: ["Manjhand"],
      "Sehwan Sharif": ["Sehwan Sharif"],
    },
    "Karachi Central": {
      "Gulberg Town": ["Karachi"],
      "Liaquatabad Town": ["Karachi"],
      "North Nazimabad": ["Karachi"],
    },
    "Karachi East": {
      "Gulshan-e-Iqbal": ["Karachi"],
      Jamshed: ["Karachi"],
      "Korangi": ["Karachi"],
    },
    "Karachi South": {
      Saddar: ["Karachi"],
      Lyari: ["Karachi"],
      "Kemari": ["Karachi"],
    },
    "Karachi West": {
      "Orangi Town": ["Karachi"],
      "SITE Town": ["Karachi"],
      Baldia: ["Karachi"],
    },
    "Malir": {
      Malir: ["Karachi"],
      "Bin Qasim": ["Karachi"],
      Gadap: ["Karachi"],
    },
    "Kambar Shahdadkot": {
      "Kambar": ["Kambar"],
      Shahdadkot: ["Shahdadkot"],
      "Miro Khan": ["Miro Khan"],
      Warah: ["Warah"],
    },
    Kashmore: {
      Kashmore: ["Kashmore"],
      Kandhkot: ["Kandhkot"],
      "Tangwani": ["Tangwani"],
    },
    Khairpur: {
      Khairpur: ["Khairpur"],
      "Gambat": ["Gambat"],
      "Kot Diji": ["Kot Diji"],
      "Sobho Dero": ["Sobho Dero"],
      "Thari Mirwah": ["Thari Mirwah"],
    },
    Larkana: {
      Larkana: ["Larkana"],
      Bakrani: ["Bakrani"],
      Dokri: ["Dokri"],
      Ratodero: ["Ratodero"],
    },
    Matiari: {
      Matiari: ["Matiari"],
      Hala: ["Hala"],
      "Saeedabad": ["Saeedabad"],
    },
    Mirpurkhas: {
      Mirpurkhas: ["Mirpurkhas"],
      Digri: ["Digri"],
      "Kot Ghulam Muhammad": ["Kot Ghulam Muhammad"],
      Sindhri: ["Sindhri"],
    },
    "Naushahro Feroze": {
      "Naushahro Feroze": ["Naushahro Feroze"],
      Bhiria: ["Bhiria"],
      Kandiaro: ["Kandiaro"],
      "Moro": ["Moro"],
    },
    "Shaheed Benazirabad": {
      Nawabshah: ["Nawabshah"],
      Daur: ["Daur"],
      "Qazi Ahmed": ["Qazi Ahmed"],
      Sakrand: ["Sakrand"],
    },
    Sanghar: {
      Sanghar: ["Sanghar"],
      "Jam Nawaz Ali": ["Jam Nawaz Ali"],
      "Sinjhoro": ["Sinjhoro"],
      "Tando Adam": ["Tando Adam"],
    },
    Shikarpur: {
      Shikarpur: ["Shikarpur"],
      "Garhi Yasin": ["Garhi Yasin"],
      Khanpur: ["Khanpur"],
      Lakhi: ["Lakhi"],
    },
    Sujawal: {
      Sujawal: ["Sujawal"],
      "Jati": ["Jati"],
      "Shah Bandar": ["Shah Bandar"],
    },
    Sukkur: {
      Sukkur: ["Sukkur"],
      "Rohri": ["Rohri"],
      "Pano Aqil": ["Pano Aqil"],
      "Saleh Pat": ["Saleh Pat"],
    },
    "Tando Allahyar": {
      "Tando Allahyar": ["Tando Allahyar"],
      "Chamber": ["Chamber"],
      "Jhando Mari": ["Jhando Mari"],
    },
    "Tando Muhammad Khan": {
      "Tando Muhammad Khan": ["Tando Muhammad Khan"],
      "Tando Ghulam Hyder": ["Tando Ghulam Hyder"],
      "Bulri Shah Karim": ["Bulri Shah Karim"],
    },
    Tharparkar: {
      Mithi: ["Mithi"],
      Chachro: ["Chachro"],
      Diplo: ["Diplo"],
      Islamkot: ["Islamkot"],
      Nagarparkar: ["Nagarparkar"],
    },
    Thatta: {
      Thatta: ["Thatta"],
      "Mirpur Sakro": ["Mirpur Sakro"],
      "Keti Bunder": ["Keti Bunder"],
    },
    Umerkot: {
      Umerkot: ["Umerkot"],
      Kunri: ["Kunri"],
      "Pithoro": ["Pithoro"],
      Samaro: ["Samaro"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // KPK (Khyber Pakhtunkhwa)
  // ═══════════════════════════════════════════════════════════════
  KPK: {
    Abbottabad: {
      Abbottabad: ["Abbottabad"],
      Havelian: ["Havelian"],
      "Lora": ["Lora"],
    },
    Bannu: {
      Bannu: ["Bannu"],
      Domel: ["Domel"],
    },
    Battagram: {
      Battagram: ["Battagram"],
      Allai: ["Allai"],
    },
    Buner: {
      Daggar: ["Daggar"],
      Gagra: ["Gagra"],
      Chamla: ["Chamla"],
    },
    Charsadda: {
      Charsadda: ["Charsadda"],
      Shabqadar: ["Shabqadar"],
      Tangi: ["Tangi"],
    },
    Chitral: {
      "Chitral Upper": ["Chitral"],
      "Chitral Lower": ["Drosh"],
    },
    "Dir Lower": {
      Timergara: ["Timergara"],
      Adenzai: ["Adenzai"],
      Balambat: ["Balambat"],
      Samarbagh: ["Samarbagh"],
    },
    "Dir Upper": {
      Dir: ["Dir"],
      Wari: ["Wari"],
      Sheringal: ["Sheringal"],
    },
    Hangu: {
      Hangu: ["Hangu"],
      "Tall": ["Tall"],
    },
    Haripur: {
      Haripur: ["Haripur"],
      Ghazi: ["Ghazi"],
      Khanpur: ["Khanpur"],
    },
    Karak: {
      Karak: ["Karak"],
      "Takht-e-Nasrati": ["Takht-e-Nasrati"],
    },
    Kohat: {
      Kohat: ["Kohat"],
      Lachi: ["Lachi"],
    },
    "Lakki Marwat": {
      "Lakki Marwat": ["Lakki Marwat"],
      Naurang: ["Naurang"],
      "Serai Naurang": ["Serai Naurang"],
    },
    Malakand: {
      Batkhela: ["Batkhela"],
      "Sam Ranizai": ["Sam Ranizai"],
    },
    Mansehra: {
      Mansehra: ["Mansehra"],
      Balakot: ["Balakot"],
      Oghi: ["Oghi"],
    },
    Mardan: {
      Mardan: ["Mardan"],
      Katlang: ["Katlang"],
      "Takht Bhai": ["Takht Bhai"],
    },
    Nowshera: {
      Nowshera: ["Nowshera"],
      Pabbi: ["Pabbi"],
      "Risalpur Cantt": ["Risalpur"],
    },
    Peshawar: {
      "Peshawar City": ["Peshawar"],
      "Peshawar Sadar": ["Peshawar"],
    },
    Shangla: {
      Alpurai: ["Alpurai"],
      Puran: ["Puran"],
      Bisham: ["Bisham"],
    },
    Swabi: {
      Swabi: ["Swabi"],
      Lahor: ["Lahor"],
      Razzar: ["Razzar"],
      Topi: ["Topi"],
    },
    Swat: {
      "Mingora": ["Mingora"],
      Barikot: ["Barikot"],
      Kabal: ["Kabal"],
      Matta: ["Matta"],
      Khwazakhela: ["Khwazakhela"],
    },
    Tank: {
      Tank: ["Tank"],
    },
    "Dera Ismail Khan": {
      "Dera Ismail Khan": ["Dera Ismail Khan"],
      Daraban: ["Daraban"],
      Kulachi: ["Kulachi"],
      Paroa: ["Paroa"],
    },
    Torghar: {
      Judbah: ["Judbah"],
      Oghi: ["Oghi"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BALOCHISTAN
  // ═══════════════════════════════════════════════════════════════
  Balochistan: {
    Quetta: {
      Quetta: ["Quetta"],
    },
    Pishin: {
      Pishin: ["Pishin"],
      Barshore: ["Barshore"],
    },
    "Killa Abdullah": {
      "Killa Abdullah": ["Chaman", "Killa Abdullah"],
      Gulistan: ["Gulistan"],
    },
    "Killa Saifullah": {
      "Killa Saifullah": ["Killa Saifullah"],
      "Muslim Bagh": ["Muslim Bagh"],
    },
    Zhob: {
      Zhob: ["Zhob"],
      "Qamar Din Karez": ["Qamar Din Karez"],
    },
    Loralai: {
      Loralai: ["Loralai"],
      Duki: ["Duki"],
      Mekhtar: ["Mekhtar"],
    },
    Sibi: {
      Sibi: ["Sibi"],
      "Lehri": ["Lehri"],
    },
    Ziarat: {
      Ziarat: ["Ziarat"],
      Sinjawi: ["Sinjawi"],
    },
    Harnai: {
      Harnai: ["Harnai"],
      Shahrig: ["Shahrig"],
    },
    Naseerabad: {
      Naseerabad: ["Dera Murad Jamali"],
      Tamboo: ["Tamboo"],
    },
    Jaffarabad: {
      Jaffarabad: ["Dera Allah Yar"],
      "Usta Muhammad": ["Usta Muhammad"],
      Gandakha: ["Gandakha"],
    },
    "Jhal Magsi": {
      "Jhal Magsi": ["Gandawah"],
    },
    Bolan: {
      Bolan: ["Mach"],
      "Dhadar": ["Dhadar"],
    },
    Kalat: {
      Kalat: ["Kalat"],
      Mangochar: ["Mangochar"],
    },
    Mastung: {
      Mastung: ["Mastung"],
    },
    Khuzdar: {
      Khuzdar: ["Khuzdar"],
      Naal: ["Naal"],
      Wadh: ["Wadh"],
    },
    Lasbela: {
      Uthal: ["Uthal"],
      "Hub": ["Hub"],
      Bela: ["Bela"],
    },
    Awaran: {
      Awaran: ["Awaran"],
    },
    Kech: {
      Turbat: ["Turbat"],
      Buleda: ["Buleda"],
      Dasht: ["Dasht"],
    },
    Gwadar: {
      Gwadar: ["Gwadar"],
      Jiwani: ["Jiwani"],
      Pasni: ["Pasni"],
      Ormara: ["Ormara"],
    },
    Panjgur: {
      Panjgur: ["Panjgur"],
      Parom: ["Parom"],
    },
    Washuk: {
      Washuk: ["Washuk"],
      Basima: ["Basima"],
    },
    Chagai: {
      Chagai: ["Chagai"],
      Dalbandin: ["Dalbandin"],
      Nushki: ["Nushki"],
      Nokkundi: ["Nokkundi"],
    },
    "Dera Bugti": {
      "Dera Bugti": ["Dera Bugti", "Sui"],
      Phelawagh: ["Phelawagh"],
    },
    Kohlu: {
      Kohlu: ["Kohlu"],
    },
    Musakhel: {
      Musakhel: ["Musakhel"],
      "Drug": ["Drug"],
    },
    Sherani: {
      Sherani: ["Sherani"],
    },
    Sohbatpur: {
      Sohbatpur: ["Sohbatpur"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CAPITAL TERRITORY
  // ═══════════════════════════════════════════════════════════════
  "Capital Territory": {
    Islamabad: {
      "Islamabad Urban": ["Islamabad"],
      "Islamabad Rural": ["Islamabad"],
      "Nilore": ["Nilore"],
      "Tarnol": ["Tarnol"],
      "Sihala": ["Sihala"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // GILGIT-BALTISTAN
  // ═══════════════════════════════════════════════════════════════
  "Gilgit-Baltistan": {
    Gilgit: {
      Gilgit: ["Gilgit"],
      Danyor: ["Danyor"],
      Juglot: ["Juglot"],
    },
    Skardu: {
      Skardu: ["Skardu"],
      Shigar: ["Shigar"],
      Roundu: ["Roundu"],
    },
    Hunza: {
      Aliabad: ["Aliabad", "Karimabad"],
      Gulmit: ["Gulmit"],
    },
    Nagar: {
      Nagar: ["Nagar"],
      Chalt: ["Chalt"],
    },
    Ghizer: {
      Gahkuch: ["Gahkuch"],
      Ishkoman: ["Ishkoman"],
      Punial: ["Punial"],
      Yasin: ["Yasin"],
    },
    Ghanche: {
      Khaplu: ["Khaplu"],
      Mashabrum: ["Mashabrum"],
    },
    Diamer: {
      Chilas: ["Chilas"],
      "Darel": ["Darel"],
      Tangir: ["Tangir"],
    },
    Astore: {
      Astore: ["Astore"],
    },
    Kharmang: {
      Kharmang: ["Kharmang"],
      Olding: ["Olding"],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // AJK (Azad Jammu & Kashmir)
  // ═══════════════════════════════════════════════════════════════
  AJK: {
    Muzaffarabad: {
      Muzaffarabad: ["Muzaffarabad"],
      Patika: ["Patika"],
    },
    Mirpur: {
      Mirpur: ["Mirpur"],
      Dadyal: ["Dadyal"],
    },
    Kotli: {
      Kotli: ["Kotli"],
      Sehnsa: ["Sehnsa"],
      Fatehpur: ["Fatehpur"],
    },
    Bhimber: {
      Bhimber: ["Bhimber"],
      Barnala: ["Barnala"],
      Samahni: ["Samahni"],
    },
    Bagh: {
      Bagh: ["Bagh"],
      Dhirkot: ["Dhirkot"],
      "Hari Ghel": ["Hari Ghel"],
    },
    "Poonch (Rawalakot)": {
      Rawalakot: ["Rawalakot"],
      Abbaspur: ["Abbaspur"],
      Hajira: ["Hajira"],
      Thorar: ["Thorar"],
    },
    "Hattian Bala": {
      "Hattian Bala": ["Hattian Bala"],
      Chinari: ["Chinari"],
    },
    Haveli: {
      "Forward Kahuta": ["Forward Kahuta"],
      Mumtazabad: ["Mumtazabad"],
    },
    Sudhanoti: {
      Pallandri: ["Pallandri"],
      Baloch: ["Baloch"],
      Trarkhal: ["Trarkhal"],
    },
    Neelum: {
      Athmuqam: ["Athmuqam"],
      Sharda: ["Sharda"],
      "Kel": ["Kel"],
    },
  },
};

// ─── Helper functions ────────────────────────────────────────────────────────

export function getDistricts(province: string): string[] {
  return Object.keys(PAKISTAN_GEO[province] ?? {}).sort();
}

export function getTehsils(province: string, district: string): string[] {
  return Object.keys(PAKISTAN_GEO[province]?.[district] ?? {}).sort();
}

export function getCities(province: string, district: string, tehsil: string): string[] {
  return (PAKISTAN_GEO[province]?.[district]?.[tehsil] ?? []).sort();
}
