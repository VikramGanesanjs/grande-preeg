from psychopy import visual, core, event
import random

win = visual.Window(size=[1920,1080], color='black', fullscr=True)

letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
target = 'X'

stim = visual.TextStim(win, text='', color='white', height=0.15)
fix = visual.TextStim(win, text='+', color='white')

clock = core.Clock()

for trial in range(600):  # ~15 min
    # fixation
    fix.draw()
    win.flip()
    core.wait(0.5)

    # stimulus
    letter = random.choice(letters)
    stim.text = letter
    stim.draw()
    win.flip()
    clock.reset()

    keys = event.waitKeys(maxWait=1.2, keyList=['space'], timeStamped=clock)

    # blank
    win.flip()
    core.wait(random.uniform(0.75, 1.25))

    # log trial info
    # (letter, target?, response?, RT)

