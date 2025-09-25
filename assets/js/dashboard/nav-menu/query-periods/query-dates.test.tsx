import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestContextProviders } from '../../../../test-utils/app-context-providers'
import { stringifySearch } from '../../util/url-search-params'
import { useNavigate } from 'react-router-dom'
import { getRouterBasepath } from '../../router'
import { QueryPeriodsPicker } from './query-periods-picker'
import { mockAnimationsApi, mockResizeObserver } from 'jsdom-testing-mocks'

mockAnimationsApi()
mockResizeObserver()

const domain = 'picking-query-dates.test'
const periodStorageKey = `period__${domain}`

test('if no period is stored, loads with default value of "28 derniers jours", all expected options are present', async () => {
  expect(localStorage.getItem(periodStorageKey)).toBe(null)
  render(<QueryPeriodsPicker />, {
    wrapper: (props) => (
      <TestContextProviders siteOptions={{ domain }} {...props} />
    )
  })

  await userEvent.click(screen.getByText('28 derniers jours'))

  expect(screen.getByTestId('datemenu')).toBeVisible()
  expect(screen.getAllByRole('link').map((el) => el.textContent)).toEqual(
    [
      ["Aujourd'hui", 'D'],
      ['Hier', 'E'],
      ['En temps réel', 'R'],
      ['7 derniers jours', 'W'],
      ['28 derniers jours', 'F'],
      ['91 derniers jours', 'N'],
      ['Depuis le début du mois', 'M'],
      ['Mois dernier', 'P'],
      ["Depuis le début de l'année", 'Y'],
      ['12 derniers mois', 'L'],
      ['Toutes périodes', 'A'],
      ['Période personnalisée', 'C'],
      ['Comparer', 'X']
    ].map((a) => a.join(''))
  )
})

test('user can select a new period and its value is stored', async () => {
  render(<QueryPeriodsPicker />, {
    wrapper: (props) => (
      <TestContextProviders siteOptions={{ domain }} {...props} />
    )
  })

  expect(screen.queryByTestId('datemenu')).toBeNull()
  await userEvent.click(screen.getByText('28 derniers jours'))
  expect(screen.getByTestId('datemenu')).toBeVisible()
  await userEvent.click(screen.getByText('Toutes périodes'))
  expect(screen.queryByTestId('datemenu')).not.toBeInTheDocument()
  expect(localStorage.getItem(periodStorageKey)).toBe('all')
})

test('period "all" is respected, and Compare option is not present for it in menu', async () => {
  localStorage.setItem(periodStorageKey, 'all')

  render(<QueryPeriodsPicker />, {
    wrapper: (props) => (
      <TestContextProviders siteOptions={{ domain }} {...props} />
    )
  })

  await userEvent.click(screen.getByText('Toutes périodes'))
  expect(screen.getByTestId('datemenu')).toBeVisible()
  expect(screen.queryByText('Comparer')).toBeNull()
})

test.each([
  [{ period: 'all' }, 'Toutes périodes'],
  [{ period: 'month' }, 'Depuis le début du mois'],
  [{ period: 'year' }, "Depuis le début de l'année"]
])(
  'the query period from search %p is respected and stored',
  async (searchRecord, buttonText) => {
    const startUrl = `${getRouterBasepath({ domain, shared: false })}${stringifySearch(searchRecord)}`

    render(<QueryPeriodsPicker />, {
      wrapper: (props) => (
        <TestContextProviders
          siteOptions={{ domain }}
          routerProps={{ initialEntries: [startUrl] }}
          {...props}
        />
      )
    })

    expect(screen.getByText(buttonText)).toBeVisible()
    expect(localStorage.getItem(periodStorageKey)).toBe(searchRecord.period)
  }
)

test.each([
  [
    { period: 'custom', from: '2024-08-10', to: '2024-08-20' },
    '10 Aug - 20 Aug 24'
  ],
  [{ period: 'realtime' }, 'En temps réel']
])(
  'the query period from search %p is respected but not stored',
  async (searchRecord, buttonText) => {
    const startUrl = `${getRouterBasepath({ domain, shared: false })}${stringifySearch(searchRecord)}`

    render(<QueryPeriodsPicker />, {
      wrapper: (props) => (
        <TestContextProviders
          siteOptions={{ domain }}
          routerProps={{ initialEntries: [startUrl] }}
          {...props}
        />
      )
    })
    expect(screen.getByText(buttonText)).toBeVisible()
    expect(localStorage.getItem(periodStorageKey)).toBe(null)
  }
)

test.each([
  ['all', '7d', '7 derniers jours'],
  ['30d', 'month', 'Depuis le début du mois']
])(
  'if the stored period is %p but query period is %p, query is respected and the stored period is overwritten',
  async (storedPeriod, queryPeriod, buttonText) => {
    localStorage.setItem(periodStorageKey, storedPeriod)
    const startUrl = `${getRouterBasepath({ domain, shared: false })}${stringifySearch({ period: queryPeriod })}`

    render(<QueryPeriodsPicker />, {
      wrapper: (props) => (
        <TestContextProviders
          siteOptions={{ domain, shared: false }}
          routerProps={{
            initialEntries: [startUrl]
          }}
          {...props}
        />
      )
    })

    await userEvent.click(screen.getByText(buttonText))
    expect(screen.getByTestId('datemenu')).toBeVisible()
    expect(localStorage.getItem(periodStorageKey)).toBe(queryPeriod)
  }
)

test('going back resets the stored query period to previous value', async () => {
  const BrowserBackButton = () => {
    const navigate = useNavigate()
    return (
      <button data-testid="browser-back" onClick={() => navigate(-1)}></button>
    )
  }
  render(
    <>
      <QueryPeriodsPicker />
      <BrowserBackButton />
    </>,
    {
      wrapper: (props) => (
        <TestContextProviders siteOptions={{ domain }} {...props} />
      )
    }
  )

  await userEvent.click(screen.getByText('28 derniers jours'))
  await userEvent.click(screen.getByText("Depuis le début de l'année"))
  expect(screen.queryByTestId('datemenu')).not.toBeInTheDocument()

  expect(localStorage.getItem(periodStorageKey)).toBe('year')

  await userEvent.click(screen.getByText("Depuis le début de l'année"))
  await userEvent.click(screen.getByText('Depuis le début du mois'))
  expect(screen.queryByTestId('datemenu')).not.toBeInTheDocument()

  expect(localStorage.getItem(periodStorageKey)).toBe('month')

  await userEvent.click(screen.getByTestId('browser-back'))
  expect(screen.getByText("Depuis le début de l'année")).toBeVisible()
  expect(localStorage.getItem(periodStorageKey)).toBe('year')
})
