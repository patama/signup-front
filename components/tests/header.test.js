import ReactTestRenderer from 'react-test-renderer'
import Header from '../header'

require('../../lib/tests/utils') // eslint-disable-line import/no-unassigned-import

describe('components | Header', () => {
  describe('render', () => {
    const renderer = ReactTestRenderer.create(<Header />)
    it('should be defined', () => {
      expect(renderer).toBeDefined()
    })
    it('should match snapshot', () => {
      expect(renderer).toMatchSnapshot()
    })
  })
})
