import type { Paper, Section } from '../types'
import { uid } from './id'

const q = (text: string, extra: Partial<Section['questions'][number]> = {}) => ({ id: uid(), text, ...extra })

/** Sample paper that mirrors the school's own typed format — used for template previews and the demo. */
export function samplePaper(school = 'Little Flower Convent School, Faridabad'): Paper {
  return {
    id: uid(),
    name: 'Class 1 · EVS (sample)',
    templateId: 'littleflower',
    photos: [],
    diagrams: [],
    header: {
      school,
      exam: 'Second Terminal Examination',
      className: '1st',
      subject: 'E.V.S',
      time: '2 Hours',
      maxMarks: '50',
      instructions: [],
    },
    sections: [
      {
        id: uid(), title: 'Tick (✓) the correct answer:', marks: '5', type: 'list',
        questions: [
          q('We need water for bathing / sleeping.'),
          q('We store water in bags / bottle.'),
          q('A toy / dog needs water to live.'),
          q('We get water from rain / sun.'),
          q('We must save / waste water.'),
        ],
      },
      {
        id: uid(), title: 'Fill in the blanks:', marks: '10', type: 'fill',
        questions: [
          q('We need ____ to live.'),
          q('Air helps us ____ to dry.'),
          q('Fast moving air is called ____.'),
          q('Watermelon is a ____.'),
          q('____ is a cereal.'),
          q('Very big plants are called ____.'),
          q('Trees are called our ____.'),
          q('My skin helps me to ____ hot or cold.'),
          q('My nose helps me to ____ flower.'),
          q('My eyes help me to ____ books.'),
        ],
      },
      {
        id: uid(), title: 'Names:', marks: '2½ × 8 = 20', type: 'list',
        questions: [
          q('Name five sense organs.'),
          q('Name two pulses.'),
          q('Name three vegetables.'),
          q('Name three fruits.'),
          q('Name three water animals.'),
          q('Name three animals from which we get milk.'),
          q('Name three animals which carry our loads.'),
          q('Name any three sources of water.'),
        ],
      },
      {
        id: uid(), title: 'Match the following:', marks: '5', type: 'match', questions: [],
        pairs: [
          { id: uid(), left: 'Buffalo', right: 'Leather' },
          { id: uid(), left: 'Hen', right: 'Fur' },
          { id: uid(), left: 'Rabbit', right: 'Milk' },
          { id: uid(), left: 'Crocodile', right: 'Eggs' },
          { id: uid(), left: 'Sheep', right: 'Wool' },
        ],
      },
      {
        id: uid(), title: 'Answer the following Questions:', marks: '10', type: 'list',
        questions: [
          q('Can you see air?'),
          q('Can we live without water?'),
          q('What do birds have to fly?'),
          q('How many legs does an insect have?'),
          q('What are trees?'),
        ],
      },
    ],
    fontScale: 1,
    showStudentFields: false,
    status: 'done',
    updatedAt: Date.now(),
  }
}

/** Short mixed-language / maths demo used in template thumbnails. */
export function mathDemoSections(): Section[] {
  return [
    {
      id: uid(), title: 'Choose the correct option:', marks: '1 × 3 = 3', type: 'mcq',
      questions: [
        q('The value of $\\frac{3}{4} + \\frac{1}{4}$ is', { options: ['$\\frac{1}{2}$', '1', '$\\frac{4}{8}$', '2'] }),
        q('The chemical formula of water is', { options: ['$\\ce{H2O}$', '$\\ce{CO2}$', '$\\ce{O2}$', '$\\ce{NaCl}$'] }),
        q('भारत की राजधानी ____ है।', { options: ['मुंबई', 'नई दिल्ली', 'कोलकाता', 'चेन्नई'] }),
      ],
    },
  ]
}

export function blankPaper(school: string, logo?: string): Paper {
  return {
    id: uid(),
    name: 'Untitled paper',
    templateId: 'littleflower',
    photos: [],
    diagrams: [],
    header: { school, exam: '', className: '', subject: '', time: '', maxMarks: '', instructions: [], logo },
    sections: [],
    fontScale: 1,
    showStudentFields: false,
    status: 'empty',
    updatedAt: Date.now(),
  }
}
