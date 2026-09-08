// ── Philippine Standard Geographic Data (Cascading PSGC Hierarchy) ───────────
// Provides hierarchical cascading relations: Region -> Province -> Municipality / City -> Barangay
// Contains all 17 Philippine Regions + NIR + NCR and all 82 Provinces.

export const PH_GEODATA = {
  "Region I (Ilocos Region)": {
    "provinces": {
      "Ilocos Norte": {
        "municipalities": {
          "Laoag City": [
            "Poblacion",
            "San Guillermo",
            "San Jose",
            "Nalbo"
          ],
          "Batac City": [
            "Poblacion",
            "Agcaoili",
            "Bilandang"
          ],
          "Pagudpud": [
            "Poblacion",
            "Saud",
            "Balaoi"
          ]
        }
      },
      "Ilocos Sur": {
        "municipalities": {
          "Vigan City": [
            "Poblacion",
            "Tamag",
            "Pantay Daya",
            "Ayusan"
          ],
          "Candon City": [
            "Poblacion",
            "Calaoan",
            "San Jose"
          ],
          "Narvacan": [
            "Poblacion",
            "Santa Lucia"
          ]
        }
      },
      "La Union": {
        "municipalities": {
          "San Fernando City": [
            "Poblacion",
            "Sevilla",
            "Catbangen",
            "Lingsat"
          ],
          "Agoo": [
            "Poblacion",
            "San Nicolas",
            "Santa Barbara"
          ],
          "San Juan": [
            "Poblacion",
            "Urbiztondo",
            "Ili Norte"
          ]
        }
      },
      "Pangasinan": {
        "municipalities": {
          "Dagupan City": [
            "Poblacion",
            "Lucao",
            "Pantal",
            "Bonuan Gueset"
          ],
          "Alaminos City": [
            "Poblacion",
            "Lucap",
            "Palamis"
          ],
          "Urdaneta City": [
            "Poblacion",
            "Nancayasan",
            "Anonas"
          ],
          "Lingayen": [
            "Poblacion",
            "Maniboc",
            "Pangapisan"
          ]
        }
      }
    }
  },
  "Region II (Cagayan Valley)": {
    "provinces": {
      "Batanes": {
        "municipalities": {
          "Basco": [
            "San Antonio (Pob.)",
            "Chanarian",
            "Kayvaluganan"
          ],
          "Itbayat": [
            "Santa Maria",
            "San Rafael"
          ],
          "Sabtang": [
            "Sinakan",
            "Malakdang"
          ]
        }
      },
      "Cagayan": {
        "municipalities": {
          "Tuguegarao City": [
            "Centro 01 (Pob.)",
            "Caritan",
            "Pengue-Ruyu",
            "Buntun"
          ],
          "Aparri": [
            "Centro 01",
            "Punta",
            "Toran"
          ],
          "Lal-lo": [
            "Centro",
            "Catayauan"
          ]
        }
      },
      "Isabela": {
        "municipalities": {
          "Ilagan City": [
            "Centro Poblacion",
            "Alibagu",
            "Guinatan",
            "Calamagui 2nd"
          ],
          "Santiago City": [
            "Centro Poblacion",
            "Victory Norte"
          ],
          "Cauayan City": [
            "Centro Poblacion",
            "San Fermin"
          ]
        }
      },
      "Nueva Vizcaya": {
        "municipalities": {
          "Bayombong": [
            "District IV (Pob.)",
            "Don Mariano Marcos",
            "Bonfal West"
          ],
          "Solano": [
            "Poblacion",
            "Roxas",
            "Quezon"
          ],
          "Bambang": [
            "Banggot (Pob.)",
            "Buag"
          ]
        }
      },
      "Quirino": {
        "municipalities": {
          "Cabarroguis": [
            "Mangandingay",
            "Zamora (Pob.)",
            "San Marcos"
          ],
          "Diffun": [
            "Andres Bonifacio (Pob.)",
            "Aurora East"
          ],
          "Maddela": [
            "Poblacion Norte",
            "Poblacion Sur"
          ]
        }
      }
    }
  },
  "Region III (Central Luzon)": {
    "provinces": {
      "Aurora": {
        "municipalities": {
          "Baler": [
            "Poblacion",
            "Sabang",
            "Suklayin",
            "Pingit"
          ],
          "Dingalan": [
            "Poblacion",
            "Paltic",
            "Tanawan"
          ],
          "Casiguran": [
            "Poblacion",
            "Calabgan"
          ]
        }
      },
      "Bataan": {
        "municipalities": {
          "Balanga City": [
            "Poblacion",
            "San Jose",
            "Ibayo",
            "Cupang North"
          ],
          "Mariveles": [
            "Poblacion",
            "Alas-asin",
            "Malaya"
          ],
          "Dinalupihan": [
            "Poblacion",
            "San Ramon"
          ]
        }
      },
      "Bulacan": {
        "municipalities": {
          "Malolos City": [
            "Santo Rosario (Pob.)",
            "San Gabriel",
            "Mojon",
            "Catmon"
          ],
          "San Jose del Monte City": [
            "Tungkong Mangga",
            "Muzon",
            "Graceville"
          ],
          "Meycauayan City": [
            "Poblacion",
            "Calvario",
            "Bancal"
          ]
        }
      },
      "Nueva Ecija": {
        "municipalities": {
          "Palayan City": [
            "Atate",
            "Caimito",
            "Singalat"
          ],
          "Cabanatuan City": [
            "Poblacion",
            "Sangitan West",
            "Kapitan Pepe",
            "Zulueta"
          ],
          "Gapan City": [
            "San Vicente",
            "Bamban"
          ]
        }
      },
      "Pampanga": {
        "municipalities": {
          "San Fernando City": [
            "Dolores",
            "San Jose",
            "Santo Rosario",
            "Sindalan"
          ],
          "Angeles City": [
            "Balibago",
            "Cutcut",
            "Sto. Domingo",
            "Pandan"
          ],
          "Mabalacat City": [
            "Dau",
            "Poblacion",
            "Camachiles"
          ]
        }
      },
      "Tarlac": {
        "municipalities": {
          "Tarlac City": [
            "Poblacion",
            "San Roque",
            "San Vicente",
            "Matatalaib"
          ],
          "Capas": [
            "Santo Domingo",
            "Cutcut",
            "Cristo Rey"
          ],
          "Concepcion": [
            "San Nicolas",
            "Alfonso"
          ]
        }
      },
      "Zambales": {
        "municipalities": {
          "Iba": [
            "Poblacion",
            "Palanginan",
            "Amungan"
          ],
          "Olongapo City": [
            "Barretto",
            "East Bajac-Bajac",
            "Gordon Heights",
            "West Tapinac"
          ],
          "Subic": [
            "Baraca-Camachile",
            "Calapacuan",
            "Matain"
          ]
        }
      }
    }
  },
  "Region IV-A (CALABARZON)": {
    "provinces": {
      "Batangas": {
        "municipalities": {
          "Batangas City": [
            "Poblacion",
            "Alangilan",
            "Kumintang Ilaya",
            "Balagtas"
          ],
          "Lipa City": [
            "Poblacion",
            "Marawoy",
            "Sabang",
            "Tambo"
          ],
          "Nasugbu": [
            "Poblacion",
            "Wawa",
            "Bucana"
          ]
        }
      },
      "Cavite": {
        "municipalities": {
          "Trece Martires City": [
            "San Agustin",
            "Osorio",
            "De Ocampo"
          ],
          "Imus City": [
            "Poblacion",
            "Bucandala",
            "Malagasang"
          ],
          "Tagaytay City": [
            "Mendez Crossing",
            "Kaybagal",
            "Maharlika"
          ],
          "Dasmariñas City": [
            "Poblacion",
            "Salitran",
            "Sampaloc"
          ]
        }
      },
      "Laguna": {
        "municipalities": {
          "Santa Cruz": [
            "Poblacion",
            "Pagsawitan",
            "Gatid"
          ],
          "Calamba City": [
            "Poblacion",
            "Canlubang",
            "Pansol",
            "Real"
          ],
          "San Pedro City": [
            "Poblacion",
            "San Antonio",
            "Landayan"
          ],
          "Biñan City": [
            "Poblacion",
            "San Vicente",
            "Zapote"
          ]
        }
      },
      "Quezon": {
        "municipalities": {
          "Lucena City": [
            "Poblacion",
            "Cotta",
            "Iyam",
            "Dalahican"
          ],
          "Tayabas City": [
            "San Roque",
            "Angeles Zone I"
          ],
          "Infanta": [
            "Poblacion",
            "Dinahican",
            "Abiawin"
          ]
        }
      },
      "Rizal": {
        "municipalities": {
          "Antipolo City": [
            "Poblacion",
            "Mayamot",
            "San Roque",
            "Dela Paz"
          ],
          "Taytay": [
            "San Juan",
            "Dolores",
            "San Isidro"
          ],
          "Cainta": [
            "San Andres",
            "Santo Domingo",
            "San Roque"
          ]
        }
      }
    }
  },
  "Region IV-B (MIMAROPA)": {
    "provinces": {
      "Marinduque": {
        "municipalities": {
          "Boac": [
            "Bantad",
            "Mercado (Pob.)",
            "Isok I",
            "Malusak"
          ],
          "Santa Cruz": [
            "Poblacion",
            "Buyabod",
            "Alobo"
          ],
          "Gasan": [
            "Poblacion",
            "Pinggan"
          ]
        }
      },
      "Occidental Mindoro": {
        "municipalities": {
          "Mamburao": [
            "Poblacion 1",
            "Payompon",
            "Balansay"
          ],
          "San Jose": [
            "Poblacion",
            "Central",
            "San Roque",
            "Caminawit"
          ],
          "Sablayan": [
            "Poblacion",
            "Buenavista",
            "Ligaya"
          ]
        }
      },
      "Oriental Mindoro": {
        "municipalities": {
          "Calapan City": [
            "Poblacion",
            "Ilaya",
            "San Vicente",
            "Tawiran"
          ],
          "Puerto Galera": [
            "Poblacion",
            "Sabang",
            "White Beach",
            "San Isidro"
          ],
          "Pinamalayan": [
            "Poblacion",
            "Papandayan",
            "Marfrancisco"
          ]
        }
      },
      "Palawan": {
        "municipalities": {
          "Puerto Princesa City": [
            "Poblacion",
            "San Pedro",
            "San Miguel",
            "Santa Monica"
          ],
          "Coron": [
            "Poblacion 1",
            "Banuang Daan",
            "Tagumpay"
          ],
          "El Nido": [
            "Buena Suerte (Pob.)",
            "Corong-Corong",
            "Villa Libertad"
          ]
        }
      },
      "Romblon": {
        "municipalities": {
          "Romblon": [
            "Poblacion",
            "Sawang",
            "Bagacay"
          ],
          "Odiongan": [
            "Poblacion",
            "Budiong",
            "Dapawan"
          ],
          "San Agustin": [
            "Poblacion",
            "Carmen"
          ]
        }
      }
    }
  },
  "Region V (Bicol Region)": {
    "provinces": {
      "Albay": {
        "municipalities": {
          "Legazpi City": [
            "Poblacion",
            "Bitano",
            "Rawis",
            "Gogon",
            "Barriada"
          ],
          "Ligao City": [
            "Poblacion",
            "Dunao",
            "Tuburan"
          ],
          "Tabaco City": [
            "Poblacion",
            "Quinale Cabaloa",
            "San Carlos"
          ]
        }
      },
      "Camarines Norte": {
        "municipalities": {
          "Daet": [
            "Poblacion",
            "Bagasbas",
            "Camambugan",
            "Gahonon"
          ],
          "Labo": [
            "Poblacion",
            "Bulhao",
            "Talisay"
          ],
          "Jose Panganiban": [
            "Poblacion",
            "Paracale",
            "Larap"
          ]
        }
      },
      "Camarines Sur": {
        "municipalities": {
          "Pili": [
            "Poblacion",
            "San Agustin",
            "Cadlan"
          ],
          "Naga City": [
            "Poblacion",
            "Concepcion Grande",
            "Magsaysay",
            "Triangulo"
          ],
          "Iriga City": [
            "San Francisco",
            "San Nicolas"
          ]
        }
      },
      "Catanduanes": {
        "municipalities": {
          "Virac": [
            "Poblacion",
            "Concepcion",
            "Francia",
            "San Roque"
          ],
          "San Andres": [
            "Poblacion",
            "Codon",
            "Lictin"
          ],
          "Baras": [
            "Poblacion",
            "Puraran"
          ]
        }
      },
      "Masbate": {
        "municipalities": {
          "Masbate City": [
            "Poblacion",
            "Bagumbayan",
            "Ibingay",
            "Espinosa"
          ],
          "Milagros": [
            "Poblacion",
            "Bangkudo"
          ],
          "Aroroy": [
            "Poblacion",
            "Panique"
          ]
        }
      },
      "Sorsogon": {
        "municipalities": {
          "Sorsogon City": [
            "Poblacion",
            "Almendras-Cogon",
            "Bitan-o",
            "Cabid-an"
          ],
          "Gubat": [
            "Poblacion",
            "Pinontingan",
            "Cogon"
          ],
          "Bulan": [
            "Zone 1 (Pob.)",
            "Aquino"
          ]
        }
      }
    }
  },
  "Region VI (Western Visayas)": {
    "provinces": {
      "Aklan": {
        "municipalities": {
          "Kalibo": [
            "Poblacion",
            "Andagao",
            "Estancia",
            "Pook"
          ],
          "Malay (Boracay)": [
            "Balabag",
            "Manoc-Manoc",
            "Yapak",
            "Caticlan"
          ],
          "Numancia": [
            "Poblacion",
            "Albasan"
          ]
        }
      },
      "Antique": {
        "municipalities": {
          "San Jose de Buenavista": [
            "Poblacion",
            "Fundador",
            "Malaiba"
          ],
          "Sibalom": [
            "Poblacion",
            "Bongbongan"
          ],
          "Tibiao": [
            "Poblacion",
            "Importante"
          ]
        }
      },
      "Capiz": {
        "municipalities": {
          "Roxas City": [
            "Poblacion",
            "Baybay",
            "Tanque",
            "Tiza"
          ],
          "Panay": [
            "Poblacion",
            "Buntod"
          ],
          "Pontevedra": [
            "Poblacion",
            "Ilaya"
          ]
        }
      },
      "Guimaras": {
        "municipalities": {
          "Jordan": [
            "Poblacion",
            "Hosking",
            "San Miguel"
          ],
          "Buenavista": [
            "Poblacion",
            "New Montfort"
          ],
          "Nueva Valencia": [
            "Poblacion",
            "Alaguisoc"
          ]
        }
      },
      "Iloilo": {
        "municipalities": {
          "Iloilo City": [
            "City Proper",
            "Jaro",
            "Molo",
            "Mandurriao",
            "La Paz",
            "Arevalo"
          ],
          "Passi City": [
            "Poblacion",
            "Gines"
          ],
          "Oton": [
            "Poblacion",
            "Trapiche"
          ]
        }
      }
    }
  },
  "Region VII (Central Visayas)": {
    "provinces": {
      "Bohol": {
        "municipalities": {
          "Tagbilaran City": [
            "Poblacion I",
            "Cogon",
            "Bool",
            "Dampas"
          ],
          "Carmen": [
            "Poblacion Sur",
            "Poblacion Norte",
            "Montesuerte"
          ],
          "Panglao": [
            "Poblacion",
            "Tawala",
            "Doljo",
            "Bolod"
          ]
        }
      },
      "Cebu": {
        "municipalities": {
          "Cebu City": [
            "Lahug",
            "Mabolo",
            "Guadalupe",
            "Capitol Site",
            "Banilad",
            "Talamban"
          ],
          "Mandaue City": [
            "Centro",
            "Subangdaku",
            "Tipolo",
            "Bakilid"
          ],
          "Lapu-Lapu City": [
            "Poblacion",
            "Mactan",
            "Maribago",
            "Punta Engaño"
          ]
        }
      },
      "Siquijor": {
        "municipalities": {
          "Siquijor": [
            "Poblacion",
            "Polangyuta",
            "Dumanhog"
          ],
          "Larena": [
            "Poblacion",
            "Nonoc"
          ],
          "San Juan": [
            "Poblacion",
            "Tubod",
            "Paliton"
          ]
        }
      }
    }
  },
  "Region VIII (Eastern Visayas)": {
    "provinces": {
      "Biliran": {
        "municipalities": {
          "Naval": [
            "Poblacion",
            "Atipolo",
            "P.I. Garcia",
            "Larrazabal"
          ],
          "Biliran": [
            "Poblacion",
            "Burabod"
          ],
          "Kawayan": [
            "Poblacion",
            "Baganito"
          ]
        }
      },
      "Eastern Samar": {
        "municipalities": {
          "Borongan City": [
            "Poblacion",
            "Campesao",
            "Songco",
            "Bato"
          ],
          "Guiuan": [
            "Poblacion",
            "Campoyong",
            "Hollywood",
            "Sulangan"
          ],
          "Oras": [
            "Poblacion",
            "San Eduardo"
          ]
        }
      },
      "Leyte": {
        "municipalities": {
          "Tacloban City": [
            "Downtown",
            "San Jose",
            "Marasbaras",
            "Abucay",
            "Caibaan"
          ],
          "Ormoc City": [
            "Poblacion",
            "Linao",
            "Valencia",
            "Cogon"
          ],
          "Palo": [
            "Poblacion",
            "Candahug",
            "Baras"
          ]
        }
      },
      "Northern Samar": {
        "municipalities": {
          "Catarman": [
            "Poblacion",
            "Dalakit",
            "Ipil-ipil",
            "Macagtas"
          ],
          "Laoang": [
            "Poblacion",
            "Rawis"
          ],
          "Allen": [
            "Poblacion",
            "Kinabranan"
          ]
        }
      },
      "Samar": {
        "municipalities": {
          "Catbalogan City": [
            "Poblacion",
            "Mercedes",
            "San Roque",
            "Maulong"
          ],
          "Calbayog City": [
            "Poblacion",
            "Dagum",
            "Capoocan"
          ],
          "Basey": [
            "Poblacion",
            "San Antonio"
          ]
        }
      },
      "Southern Leyte": {
        "municipalities": {
          "Maasin City": [
            "Abgao (Poblacion)",
            "Asuncion",
            "Bactul I",
            "Bactul II",
            "Bato",
            "Bilibol",
            "Bogo",
            "Cabadiangan",
            "Cabulihan",
            "Cantuhaon",
            "Combado",
            "Dongon",
            "Guadalupe",
            "Hanginan",
            "Ibarra",
            "Isagani",
            "Laboon",
            "Luntad",
            "Mantahan",
            "Maria Clara",
            "Nonok Norte",
            "Nonok Sur",
            "Panan-awan",
            "Pasay",
            "San Rafael",
            "San Roque",
            "Soro-soro",
            "Tam-is",
            "Tawid",
            "Tigbawan",
            "Tomas Oppus",
            "Tunga-tunga"
          ],
          "Sogod": [
            "Zone I (Pob.)",
            "Zone II (Pob.)",
            "Zone III (Pob.)",
            "Zone IV (Pob.)",
            "Zone V (Pob.)",
            "Consolacion",
            "Dagsa",
            "Hibod-hibod",
            "Kahupian",
            "Libas",
            "Madaum",
            "Magatas",
            "Mahayahay",
            "Malinao",
            "Maria Plana",
            "Milagrosa",
            "Pancho Villa",
            "Poblacion",
            "Rizal",
            "San Isidro",
            "San Jose",
            "San Juan",
            "San Miguel",
            "San Pedro",
            "San Roque",
            "San Vicente",
            "Santa Maria",
            "Suba",
            "Tampacon I",
            "Tampacon II"
          ],
          "Macrohon": [
            "Aguinaldo",
            "Amparo",
            "Buscayan",
            "Cambaro",
            "Canlusay",
            "Flordeliz",
            "Ichon",
            "Ilihan",
            "Laray",
            "Mabini",
            "Mohon",
            "Molopolo",
            "Poblacion",
            "Rizal",
            "Salvacion",
            "San Isidro",
            "San Joaquin",
            "San Roque",
            "Sindangan",
            "Upper Villa"
          ],
          "Malitbog": [
            "Abgao",
            "Aurora",
            "Benit",
            "Ca-ponoan",
            "Candatag",
            "Cantamuac",
            "Caraatan",
            "Concepcion",
            "Guinabonan",
            "Iba",
            "Lambonao",
            "Mauro",
            "Poblacion",
            "Sabang",
            "San Antonio",
            "San Isidro",
            "San Jose",
            "San Roque",
            "Santa Cruz",
            "Santo Niño",
            "Tigbawan"
          ],
          "Bontoc": [
            "Bontoc Viejo",
            "Divisoria",
            "Esperanza",
            "Guinabonan",
            "Hilaan",
            "Mahayahay",
            "Olango",
            "Poblacion",
            "San Isidro",
            "San Ramon",
            "Santa Cruz",
            "Talisay",
            "Union"
          ],
          "Tomas Oppus": [
            "Anahao",
            "Banday",
            "Bogo",
            "Cambite",
            "Canlupao",
            "Carnaga",
            "Cawayan",
            "Hinapu",
            "Looc",
            "Mag-ata",
            "Poblacion",
            "Rizal",
            "San Antonio",
            "San Isidro",
            "Tinago"
          ],
          "Liloan": [
            "Bahay",
            "Calian",
            "Candayuman",
            "Estela",
            "Gud-an",
            "Ilag",
            "Magallanes",
            "Molopolo",
            "Poblacion",
            "Pres. Quezon",
            "San Isidro",
            "San Roque",
            "Tabugon"
          ],
          "Saint Bernard": [
            "Atuyan",
            "Ayahag",
            "Bolodbolod",
            "Cabagawan",
            "Carnaga",
            "Catmon",
            "Guinsaugon",
            "Himbangan",
            "Kauswagan",
            "Libas",
            "Magatas",
            "Mahayahay",
            "Malibago",
            "Poblacion",
            "San Isidro",
            "Santa Cruz",
            "Tabontabon",
            "Tambis"
          ],
          "San Juan (Cabalian)": [
            "Agay-ay",
            "Basak",
            "Bobon A",
            "Bobon B",
            "Dayhagan",
            "Garrido",
            "Minoyho",
            "Osao",
            "Poblacion",
            "San Jose",
            "San Roque",
            "Santa Cruz",
            "Somoge",
            "Sua"
          ],
          "Hinundayan": [
            "Amagusan",
            "Anahao",
            "Bangcas A",
            "Bangcas B",
            "Biasong",
            "Bugho",
            "Cabulisan",
            "Hubasan",
            "Lumbog",
            "Poblacion",
            "Sag-od",
            "San Isidro",
            "Sto. Niño"
          ],
          "Hinunangan": [
            "Babor",
            "Biasong",
            "Calag-itan",
            "Canipaan",
            "Catublian",
            "Ilag",
            "Ingon",
            "Labong",
            "Manlalis",
            "Nava",
            "Otikon",
            "Poblacion",
            "Pondol",
            "Salog",
            "Talisay"
          ],
          "Silago": [
            "Balagawan",
            "Catmon",
            "Hingatungan",
            "Laguma",
            "Mercedes",
            "Poblacion",
            "Puntana",
            "Salvacion",
            "San Isidro",
            "San Roque",
            "Sudmon",
            "Tubod"
          ],
          "Pintuyan": [
            "Bacolod",
            "Bulawan",
            "Catbawan",
            "Dan-an",
            "Manglit",
            "Poblacion",
            "Ponod",
            "Son-ok"
          ],
          "San Ricardo": [
            "Bitoon",
            "Cabutan",
            "Camang",
            "Esperanza",
            "Kinachawa",
            "Poblacion",
            "Saub",
            "Timba"
          ],
          "San Francisco": [
            "Anilao",
            "Bongbong",
            "Central",
            "Dakit",
            "Habay",
            "Marayag",
            "Pinut-an",
            "Poblacion",
            "Santa Paz"
          ],
          "Limasawa": [
            "Cabagayan",
            "Lugsongan",
            "Magallanes (Poblacion)",
            "San Agustin",
            "San Bernardo",
            "Triana"
          ],
          "Padre Burgos": [
            "Buenavista",
            "Bunga",
            "Cantutang",
            "Dinahugan",
            "Laca",
            "Lungsodaan",
            "Poblacion",
            "San Juan",
            "Santa Sofia",
            "Tangkaan"
          ],
          "Anahawan": [
            "Amagusan",
            "Calusao",
            "Canlabian",
            "Mainit",
            "Poblacion",
            "San Vicente",
            "Tagup-on"
          ]
        }
      }
    }
  },
  "Region IX (Zamboanga Peninsula)": {
    "provinces": {
      "Sulu": {
        "municipalities": {
          "Jolo": [
            "Walled City (Pob.)",
            "San Raymundo",
            "Tulay",
            "Asturias"
          ],
          "Patikul": [
            "Poblacion",
            "Bongkaung"
          ],
          "Maimbung": [
            "Poblacion",
            "Bato Ugis"
          ]
        }
      },
      "Zamboanga del Norte": {
        "municipalities": {
          "Dipolog City": [
            "Central (Pob.)",
            "Miputak",
            "Turno",
            "Estaka"
          ],
          "Dapitan City": [
            "Poblacion",
            "Potungan"
          ],
          "Sindangan": [
            "Poblacion",
            "Gusa"
          ]
        }
      },
      "Zamboanga del Sur": {
        "municipalities": {
          "Pagadian City": [
            "Gatas (Pob.)",
            "San Pedro",
            "Tuburan",
            "Balangasan"
          ],
          "Zamboanga City": [
            "Pueblo (Pob.)",
            "Tetuan",
            "Tumaga",
            "Pasonanca",
            "Santa Maria",
            "Divisoria"
          ],
          "Labangan": [
            "Poblacion",
            "Old Labangan"
          ]
        }
      },
      "Zamboanga Sibugay": {
        "municipalities": {
          "Ipil": [
            "Poblacion",
            "Sanito",
            "Don Andres"
          ],
          "Titay": [
            "Poblacion",
            "Dalangin"
          ],
          "Kabasalan": [
            "Poblacion",
            "Salipyasin"
          ]
        }
      }
    }
  },
  "Region X (Northern Mindanao)": {
    "provinces": {
      "Bukidnon": {
        "municipalities": {
          "Malaybalay City": [
            "Poblacion",
            "Casisang",
            "Sumpong",
            "Kalasungay"
          ],
          "Valencia City": [
            "Poblacion",
            "Batangan",
            "Lumbo",
            "Catualan"
          ],
          "Maramag": [
            "Anahawon",
            "Base Camp"
          ]
        }
      },
      "Camiguin": {
        "municipalities": {
          "Mambajao": [
            "Poblacion",
            "Balbagon",
            "Yumbing",
            "Agoho"
          ],
          "Catarman": [
            "Poblacion",
            "Bonbon"
          ],
          "Mahinog": [
            "Poblacion",
            "Benoni"
          ]
        }
      },
      "Lanao del Norte": {
        "municipalities": {
          "Tubod": [
            "Poblacion",
            "Pigcarangan"
          ],
          "Iligan City": [
            "Poblacion",
            "Tibanga",
            "Pala-o",
            "Suarez",
            "Buru-un"
          ],
          "Kapatagan": [
            "Poblacion",
            "Curvada"
          ]
        }
      },
      "Misamis Occidental": {
        "municipalities": {
          "Oroquieta City": [
            "Poblacion 1",
            "Canubay",
            "Mobod"
          ],
          "Ozamiz City": [
            "Poblacion",
            "Aguada",
            "Catadman"
          ],
          "Tangub City": [
            "Poblacion",
            "Maloro"
          ]
        }
      },
      "Misamis Oriental": {
        "municipalities": {
          "Cagayan de Oro City": [
            "Divisoria (Pob.)",
            "Carmen",
            "Kauswagan",
            "Lapasan",
            "Nazareth",
            "Macasandig"
          ],
          "Gingoog City": [
            "Poblacion",
            "Daan Lungsod"
          ],
          "El Salvador City": [
            "Poblacion",
            "Sambulawan"
          ]
        }
      }
    }
  },
  "Region XI (Davao Region)": {
    "provinces": {
      "Davao de Oro": {
        "municipalities": {
          "Nabunturan": [
            "Poblacion",
            "Mainit",
            "Basak"
          ],
          "Monkayo": [
            "Poblacion",
            "Mount Diwata",
            "Baylo"
          ],
          "Pantukan": [
            "Kingking (Pob.)",
            "Bongabong"
          ]
        }
      },
      "Davao del Norte": {
        "municipalities": {
          "Tagum City": [
            "Magugpo (Pob.)",
            "Apokon",
            "Visayan Village",
            "Mankilam"
          ],
          "Panabo City": [
            "Poblacion",
            "Gredu",
            "San Francisco"
          ],
          "Island Garden City of Samal": [
            "Babak",
            "Penaplata",
            "Kaputian"
          ]
        }
      },
      "Davao del Sur": {
        "municipalities": {
          "Digos City": [
            "Zone 1 (Pob.)",
            "Aplaya",
            "Tres de Mayo",
            "Cogon"
          ],
          "Santa Cruz": [
            "Zone I (Pob.)",
            "Darong",
            "Bato"
          ],
          "Bansalan": [
            "Poblacion",
            "Mabuhay"
          ],
          "Davao City": [
            "Poblacion",
            "Buhangin",
            "Talomo",
            "Matina",
            "Agdao",
            "Toril",
            "Calinan"
          ]
        }
      },
      "Davao Occidental": {
        "municipalities": {
          "Malita": [
            "Poblacion",
            "Fishing Village",
            "Tubalan"
          ],
          "Santa Maria": [
            "Poblacion",
            "San Agustin"
          ],
          "Jose Abad Santos": [
            "Caburan (Pob.)",
            "Molmol"
          ],
          "Sarangani": [
            "Mabila (Pob.)",
            "Batuganding"
          ]
        }
      },
      "Davao Oriental": {
        "municipalities": {
          "Mati City": [
            "Central (Pob.)",
            "Dahican",
            "Matiao",
            "Sainz"
          ],
          "Baganga": [
            "Poblacion",
            "Mahan-ub"
          ],
          "Governor Generoso": [
            "Poblacion",
            "Tibanban"
          ]
        }
      }
    }
  },
  "Region XII (SOCCSKSARGEN)": {
    "provinces": {
      "Cotabato": {
        "municipalities": {
          "Kidapawan City": [
            "Poblacion",
            "Paco",
            "Sudapin",
            "Manongol"
          ],
          "Midsayap": [
            "Poblacion",
            "Kapinpilan",
            "Poblacion 1"
          ],
          "Kabacan": [
            "Poblacion",
            "Katidtuan"
          ]
        }
      },
      "Sarangani": {
        "municipalities": {
          "Alabel": [
            "Poblacion",
            "Ladol",
            "Maribulan"
          ],
          "Glan": [
            "Poblacion",
            "Gumasa",
            "Burias"
          ],
          "Maitum": [
            "Poblacion",
            "Kalaong"
          ]
        }
      },
      "South Cotabato": {
        "municipalities": {
          "Koronadal City": [
            "Zone I (Pob.)",
            "General Paulino Santos",
            "Morales"
          ],
          "General Santos City": [
            "Dadiangas (Pob.)",
            "Lagao",
            "Calumpang",
            "Labangal",
            "Bula"
          ],
          "Polomolok": [
            "Poblacion",
            "Cannery Site"
          ]
        }
      },
      "Sultan Kudarat": {
        "municipalities": {
          "Isulan": [
            "Kalawag (Pob.)",
            "Dansalan"
          ],
          "Tacurong City": [
            "Poblacion",
            "New Isabela"
          ],
          "Lebak": [
            "Poblacion",
            "Kalamansig"
          ]
        }
      }
    }
  },
  "Region XIII (Caraga)": {
    "provinces": {
      "Agusan del Norte": {
        "municipalities": {
          "Cabadbaran City": [
            "Poblacion",
            "Tolosa",
            "Mabini"
          ],
          "Butuan City": [
            "Doongan",
            "Libertad",
            "San Vicente",
            "Villa Kananga",
            "Ambago"
          ],
          "Carmen": [
            "Poblacion",
            "Rojales"
          ]
        }
      },
      "Agusan del Sur": {
        "municipalities": {
          "Prosperidad": [
            "Poblacion",
            "Patin-ay"
          ],
          "Bayugan City": [
            "Poblacion",
            "Taglatawan"
          ],
          "San Francisco": [
            "Poblacion",
            "Hubang"
          ]
        }
      },
      "Dinagat Islands": {
        "municipalities": {
          "San Jose": [
            "Poblacion",
            "Matingbe",
            "Aurelio"
          ],
          "Dinagat": [
            "Poblacion",
            "Cayetano"
          ],
          "Basilisa": [
            "Poblacion",
            "Cagdianao"
          ]
        }
      },
      "Surigao del Norte": {
        "municipalities": {
          "Surigao City": [
            "Washington (Pob.)",
            "Taft",
            "San Juan",
            "Rizal"
          ],
          "General Luna (Siargao)": [
            "Poblacion",
            "Catangnan (Cloud 9)",
            "Malinao"
          ],
          "Dapa": [
            "Poblacion",
            "Union"
          ]
        }
      },
      "Surigao del Sur": {
        "municipalities": {
          "Tandag City": [
            "Bongtud (Pob.)",
            "Bag-ong Lungsod",
            "Telaje"
          ],
          "Bislig City": [
            "Mangagoy",
            "Poblacion",
            "Tabon"
          ],
          "Hinatuan": [
            "Poblacion",
            "Cambatong"
          ]
        }
      }
    }
  },
  "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)": {
    "provinces": {
      "Basilan": {
        "municipalities": {
          "Isabela City": [
            "Poblacion",
            "Menzi",
            "Tabuk"
          ],
          "Lamitan City": [
            "Poblacion",
            "Maluso"
          ],
          "Tipo-Tipo": [
            "Poblacion",
            "Badja"
          ]
        }
      },
      "Lanao del Sur": {
        "municipalities": {
          "Marawi City": [
            "Banggolo (Pob.)",
            "Matampay",
            "Toros",
            "Basak Malutlut"
          ],
          "Malabang": [
            "Poblacion",
            "Tubok"
          ],
          "Wao": [
            "Poblacion",
            "Kilala"
          ]
        }
      },
      "Maguindanao del Norte": {
        "municipalities": {
          "Datu Odin Sinsuat": [
            "Dalican (Pob.)",
            "Awang",
            "Kurintem"
          ],
          "Cotabato City": [
            "Poblacion",
            "Rosary Heights",
            "Tamontaka",
            "Bagua"
          ],
          "Parang": [
            "Poblacion",
            "Polloc"
          ]
        }
      },
      "Maguindanao del Sur": {
        "municipalities": {
          "Buluan": [
            "Poblacion",
            "Maslabeng",
            "Poblacion 2"
          ],
          "Datu Paglas": [
            "Poblacion",
            "Sepaka"
          ],
          "Shariff Aguak": [
            "Poblacion",
            "Maganoy"
          ]
        }
      },
      "Tawi-Tawi": {
        "municipalities": {
          "Bongao": [
            "Poblacion",
            "Tubig Tanah",
            "Simunul"
          ],
          "Panglima Sugala": [
            "Balimbing (Pob.)",
            "Buan"
          ],
          "Sitangkai": [
            "Poblacion",
            "Datu Baguinda Putih"
          ]
        }
      }
    }
  },
  "Cordillera Administrative Region (CAR)": {
    "provinces": {
      "Abra": {
        "municipalities": {
          "Bangued": [
            "Zone 5 (Pob.)",
            "Zone 1",
            "Zone 2"
          ],
          "Bucay": [
            "Poblacion",
            "Pakiling"
          ],
          "Dolores": [
            "Poblacion",
            "Talogtog"
          ]
        }
      },
      "Apayao": {
        "municipalities": {
          "Kabugao": [
            "Poblacion",
            "Lenneng"
          ],
          "Conner": [
            "Poblacion",
            "Malama"
          ],
          "Luna": [
            "Poblacion",
            "San Isidro"
          ]
        }
      },
      "Benguet": {
        "municipalities": {
          "La Trinidad": [
            "Poblacion",
            "Pico",
            "Balili",
            "Betag"
          ],
          "Baguio City": [
            "Session Road (Pob.)",
            "Burnham-Legarda",
            "Camp 7",
            "Loakan",
            "Mines View"
          ],
          "Itogon": [
            "Poblacion",
            "Ampucao"
          ]
        }
      },
      "Ifugao": {
        "municipalities": {
          "Lagawe": [
            "Poblacion",
            "Burnay",
            "Boliwong"
          ],
          "Banaue": [
            "Poblacion",
            "Batad",
            "Bangaan"
          ],
          "Kiangan": [
            "Poblacion",
            "Nagacadan"
          ]
        }
      },
      "Kalinga": {
        "municipalities": {
          "Tabuk City": [
            "Poblacion",
            "Dagupan",
            "Bulanao",
            "Appas"
          ],
          "Tinglayan": [
            "Poblacion",
            "Buscalan"
          ],
          "Pasil": [
            "Poblacion",
            "Guina-ang"
          ]
        }
      },
      "Mountain Province": {
        "municipalities": {
          "Bontoc": [
            "Poblacion",
            "Samoki",
            "Bontoc Ili"
          ],
          "Sagada": [
            "Poblacion",
            "Demang",
            "Madongo",
            "Fidelisan"
          ],
          "Bauko": [
            "Poblacion",
            "Abatan"
          ]
        }
      }
    }
  },
  "Negros Island Region (NIR)": {
    "provinces": {
      "Negros Occidental": {
        "municipalities": {
          "Bacolod City": [
            "Downtown (Pob.)",
            "Mandalagan",
            "Villamonte",
            "Singcang",
            "Bata",
            "Mansilingan"
          ],
          "Silay City": [
            "Poblacion",
            "Guinhalaran"
          ],
          "Bago City": [
            "Poblacion",
            "Ma-ao"
          ],
          "San Carlos City": [
            "Poblacion",
            "Palampas"
          ]
        }
      },
      "Negros Oriental": {
        "municipalities": {
          "Dumaguete City": [
            "Poblacion 1",
            "Daro",
            "Bantayan",
            "Mangnao",
            "Piapi"
          ],
          "Bais City": [
            "Poblacion",
            "Talabahan"
          ],
          "Tanjay City": [
            "Poblacion",
            "Polo"
          ]
        }
      }
    }
  },
  "NCR (National Capital Region)": {
    "provinces": {
      "Metro Manila": {
        "municipalities": {
          "Manila City": [
            "Binondo",
            "Ermita",
            "Malate",
            "Paco",
            "Pandacan",
            "Port Area",
            "Quiapo",
            "Sampaloc",
            "San Andres",
            "San Miguel",
            "San Nicolas",
            "Santa Ana",
            "Santa Cruz",
            "Santa Mesa",
            "Tondo"
          ],
          "Quezon City": [
            "Batasan Hills",
            "Commonwealth",
            "Diliman",
            "Cubao",
            "New Manila",
            "Project 4",
            "Tandang Sora"
          ],
          "Makati City": [
            "Bel-Air",
            "Poblacion",
            "San Lorenzo",
            "Urdaneta",
            "Bangkal"
          ],
          "Taguig City": [
            "Fort Bonifacio (BGC)",
            "Ususan",
            "Western Bicutan"
          ],
          "Pasig City": [
            "Kapitolyo",
            "Ortigas",
            "San Antonio",
            "Ugong"
          ],
          "Mandaluyong City": [
            "Highway Hills",
            "Wack-Wack",
            "Plainview"
          ]
        }
      }
    }
  },
  "International / Overseas": {
    "provinces": {
      "Global Diaspora": {
        "municipalities": {
          "Overseas Location": [
            "Global Patron",
            "United States",
            "Canada",
            "Europe",
            "Middle East",
            "Asia Pacific",
            "Other Global Location"
          ]
        }
      }
    }
  }
};

export const getRegions = () => Object.keys(PH_GEODATA);

export const getProvinces = (regionName) => {
  if (!regionName || !PH_GEODATA[regionName]) return [];
  return Object.keys(PH_GEODATA[regionName].provinces || {});
};

export const getMunicipalities = (regionName, provinceName) => {
  if (!regionName || !provinceName || !PH_GEODATA[regionName]?.provinces[provinceName]) return [];
  return Object.keys(PH_GEODATA[regionName].provinces[provinceName].municipalities || {});
};

export const getBarangays = (regionName, provinceName, municipalityName) => {
  if (!regionName || !provinceName || !municipalityName) return [];
  return PH_GEODATA[regionName]?.provinces[provinceName]?.municipalities[municipalityName] || [];
};
